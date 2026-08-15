import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Частичный уникальный индекс на слот врача: (doctor_id, date, time).
 *
 * Зачем нужен именно индекс, а не проверка в хуке
 * ----------------------------------------------
 * В `Appointments.beforeChange` есть предварительный `find` по слоту, но между
 * этим `find` и `INSERT` есть окно: внутри `applyBookingGuards` до вставки идут
 * `findByID(doctors)`, `findByID(users)` и `count(appointments)`. Два
 * параллельных запроса успевают пройти проверку оба. Плюс слот удаляется из
 * `doctors.schedule` в `afterChange` через `setImmediate`, то есть уже ПОСЛЕ
 * коммита — поэтому проверка «слот есть в расписании» второй запрос тоже
 * пропускает. Окно измеряется сотнями миллисекунд, а не микросекундами.
 *
 * Единственная надёжная защита от двойной брони — ограничение уровня БД.
 *
 * Почему индекс частичный (WHERE), а не `unique: true` в конфиге
 * -------------------------------------------------------------
 * `CompoundIndex` в Payload — это `{ fields, unique? }`, предиката там нет,
 * поэтому объявить это в коллекции невозможно. Но главное — полный уникальный
 * индекс здесь был бы РЕГРЕССИЕЙ, а не защитой:
 *
 *   `cancelled`-запись навсегда занимала бы свой (doctor, date, time). Каждый
 *   брошенный чекаут (пациент не оплатил, sweeper перевёл бронь в `cancelled`
 *   и вернул слот в расписание) выжигал бы слот безвозвратно: в UI он снова
 *   свободен, но `INSERT` падал бы на индексе для всех, включая самого пациента.
 *
 * Предикат ниже повторяет ровно то допущение, на котором уже построен код
 * (`status: { not_equals: 'cancelled' }` в beforeChange): отменённая запись
 * слот не занимает.
 *
 * Про `pending_payment` в предикате
 * --------------------------------
 * Предикат индекса обязан быть immutable, поэтому сослаться на `now()` и
 * исключить просроченные брони нельзя — неоплаченная бронь держит слот, пока
 * sweeper не переведёт её в `cancelled`. Расхождения это не создаёт: тот же
 * sweeper в том же проходе возвращает слот в `doctors.schedule`, а до этого
 * момента `applyPatientGuards` отклоняет запись раньше индекса — слота ещё нет
 * в расписании.
 *
 * Про CONCURRENTLY
 * ----------------
 * Payload оборачивает миграции в транзакцию, а `CREATE INDEX CONCURRENTLY`
 * внутри транзакции запрещён. Используется обычный `CREATE UNIQUE INDEX`:
 * на объёме таблицы записей блокировка незаметна.
 */

const INDEX_NAME = 'appointments_slot_unique'

/**
 * Статусы, при которых запись реально занимает слот. `cancelled` — нет.
 *
 * ВАЖНО: без приведения `status::text`. Payload хранит `select` как PostgreSQL
 * enum, а каст enum -> text помечен как STABLE (не IMMUTABLE), поэтому в
 * предикате индекса он запрещён: `functions in index predicate must be marked
 * IMMUTABLE`. Сравнение enum-колонки напрямую с литералами immutable — литералы
 * приводятся к типу enum на этапе разбора запроса.
 */
const ACTIVE_STATUSES = "('pending_payment', 'confirmed', 'in_progress', 'completed')"

type DuplicateRow = {
  doctor_id: number | string
  date: string
  time: string
  total: number | string
}

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // --- Шаг 1: убедиться, что имена колонок те, что мы ожидаем.
  // Payload генерирует snake_case (`doctor` -> `doctor_id`), но если схема
  // разойдётся, лучше упасть с понятным текстом, чем создать индекс не там.
  const columns = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'appointments'
  `)

  const present = new Set((columns.rows as { column_name: string }[]).map((r) => r.column_name))

  if (present.size === 0) {
    throw new Error(
      'Таблица "appointments" не найдена. Запустите `pnpm dev` (dev push создаёт схему), затем `pnpm migrate`.',
    )
  }

  const required = ['doctor_id', 'date', 'time', 'status']
  const missing = required.filter((c) => !present.has(c))

  if (missing.length > 0) {
    throw new Error(
      `В таблице "appointments" нет колонок: ${missing.join(', ')}. ` +
        'Схема разошлась с ожидаемой — проверьте src/collections/Appointments.ts.',
    )
  }

  // --- Шаг 2: найти уже существующие дубликаты.
  // Без этого CREATE UNIQUE INDEX упадёт с невнятной ошибкой на реальных
  // данных. На свежей БД шаг ничего не находит и просто проходит.
  const duplicates = await db.execute(sql`
    SELECT doctor_id, "date", "time", COUNT(*) AS total
    FROM appointments
    WHERE status IN ${sql.raw(ACTIVE_STATUSES)}
    GROUP BY doctor_id, "date", "time"
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `)

  const duplicateRows = duplicates.rows as DuplicateRow[]

  if (duplicateRows.length > 0) {
    const report = duplicateRows
      .map((r) => `  врач ${r.doctor_id} — ${r.date} ${r.time} (записей: ${r.total})`)
      .join('\n')

    throw new Error(
      `Найдены двойные брони — уникальный индекс на них не встанет.\n${report}\n\n` +
        'Разберите конфликты вручную: оставьте одну запись на слот, лишние переведите ' +
        'в status = \'cancelled\' (тогда они выйдут из-под индекса), после чего повторите ' +
        '`pnpm migrate`.',
    )
  }

  // --- Шаг 3: сам индекс.
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS ${sql.raw(INDEX_NAME)}
    ON appointments (doctor_id, "date", "time")
    WHERE status IN ${sql.raw(ACTIVE_STATUSES)}
  `)

  payload.logger.info(
    `[migration] ${INDEX_NAME}: двойная бронь слота теперь невозможна на уровне БД`,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS ${sql.raw(INDEX_NAME)}`)
}
