import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Колонки группы `payment` из коллекции Appointments (оплата через ЮKassa).
 *
 * Почему миграция нужна
 * ---------------------
 * В dev схему догоняет push, но на VPS приложение запускается через
 * `next start` и `pnpm migrate`. Без этой миграции создание платежа падало бы
 * на записи в несуществующие колонки уже после того, как деньги в ЮKassa
 * зарезервированы.
 *
 * Соответствие имён
 * -----------------
 * Payload разворачивает группу в плоские колонки с префиксом и snake_case:
 *   payment.provider    -> payment_provider
 *   payment.paymentId   -> payment_payment_id
 *   payment.status      -> payment_status      (PostgreSQL enum)
 *   payment.amount      -> payment_amount
 *   payment.method      -> payment_method
 *   payment.attempts    -> payment_attempts
 *   payment.refundId    -> payment_refund_id
 *   payment.refundedAt  -> payment_refunded_at
 *   payment.checkedAt   -> payment_checked_at
 *
 * Все шаги идемпотентны (IF NOT EXISTS), поэтому миграция безопасно проходит
 * и на базе, где схему уже создал dev push.
 */

/** Имя enum-типа под `payment.status` — так его называет сам Payload. */
const STATUS_ENUM = 'enum_appointments_payment_status'

/**
 * Индекс по id платежа.
 *
 * Уведомление ЮKassa приходит с id платежа, а не записи: обработчик ищет
 * запись через `where: { 'payment.paymentId': { equals } }`, и без индекса
 * каждый вебхук делал бы Seq Scan по всей таблице записей.
 */
const PAYMENT_ID_INDEX = 'appointments_payment_payment_id_idx'

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // --- Шаг 1: таблица должна существовать (иначе схему ещё не создавали).
  const table = await db.execute(sql`
    SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments'
  `)

  if (table.rows.length === 0) {
    throw new Error(
      'Таблица "appointments" не найдена. Запустите `pnpm dev` (dev push создаёт схему), затем `pnpm migrate`.',
    )
  }

  // --- Шаг 2: enum под статус платежа.
  // CREATE TYPE не поддерживает IF NOT EXISTS, поэтому глотаем duplicate_object.
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE ${sql.raw(`"${STATUS_ENUM}"`)} AS ENUM (
        'pending',
        'waiting_for_capture',
        'succeeded',
        'canceled',
        'refunded'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `)

  // --- Шаг 3: сами колонки.
  // Все nullable и без DEFAULT (кроме attempts): у существующих записей платежа
  // не было, и «0 попыток» — корректное начальное состояние.
  await db.execute(sql`
    ALTER TABLE "appointments"
      ADD COLUMN IF NOT EXISTS "payment_provider" varchar,
      ADD COLUMN IF NOT EXISTS "payment_payment_id" varchar,
      ADD COLUMN IF NOT EXISTS "payment_status" ${sql.raw(`"${STATUS_ENUM}"`)},
      ADD COLUMN IF NOT EXISTS "payment_amount" numeric,
      ADD COLUMN IF NOT EXISTS "payment_method" varchar,
      ADD COLUMN IF NOT EXISTS "payment_attempts" numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "payment_refund_id" varchar,
      ADD COLUMN IF NOT EXISTS "payment_refunded_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "payment_checked_at" timestamp(3) with time zone
  `)

  // --- Шаг 4: индекс для поиска записи по id платежа.
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ${sql.raw(`"${PAYMENT_ID_INDEX}"`)}
    ON "appointments" ("payment_payment_id")
  `)

  payload.logger.info('[migration] appointments.payment: колонки платежа ЮKassa готовы')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS ${sql.raw(`"${PAYMENT_ID_INDEX}"`)}`)

  await db.execute(sql`
    ALTER TABLE "appointments"
      DROP COLUMN IF EXISTS "payment_provider",
      DROP COLUMN IF EXISTS "payment_payment_id",
      DROP COLUMN IF EXISTS "payment_status",
      DROP COLUMN IF EXISTS "payment_amount",
      DROP COLUMN IF EXISTS "payment_method",
      DROP COLUMN IF EXISTS "payment_attempts",
      DROP COLUMN IF EXISTS "payment_refund_id",
      DROP COLUMN IF EXISTS "payment_refunded_at",
      DROP COLUMN IF EXISTS "payment_checked_at"
  `)

  // Тип удаляем только после колонок — иначе PostgreSQL не даст (зависимость).
  await db.execute(sql`DROP TYPE IF EXISTS ${sql.raw(`"${STATUS_ENUM}"`)}`)
}
