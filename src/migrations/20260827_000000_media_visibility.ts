import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Приватность файлов: `media.visibility` + `media.allowed_user_id` +
 * `media.allowed_doctor_id`.
 *
 * Зачем миграция
 * --------------
 * Коллекция media раздавалась правилом `read: () => true`, то есть записи
 * консультаций и вложения чатов (данные о здоровье) отдавались без
 * авторизации, включая список /api/media с именами файлов. Разделить
 * публичные картинки и приватные файлы можно только пометкой на документе.
 *
 * В dev схему догоняет push, но на VPS приложение поднимается через
 * `next start` и `pnpm migrate`. Без этих колонок правило доступа обращалось
 * бы к несуществующим полям, и отдача любого файла падала бы с ошибкой.
 *
 * Соответствие имён
 * -----------------
 *   visibility     -> visibility        (enum_media_visibility, DEFAULT 'public')
 *   allowedUser    -> allowed_user_id   (FK на users)
 *   allowedDoctor  -> allowed_doctor_id (FK на doctors)
 *
 * Почему DEFAULT 'public'
 * -----------------------
 * Подавляющая часть файлов - фото врачей и иконки категорий, они обязаны
 * открываться анонимному посетителю. Существующие строки остаются с NULL, и
 * правило доступа считает NULL публичным: иначе каталог мгновенно остался бы
 * без картинок.
 *
 * ВАЖНО: из-за этого уже загруженные записи консультаций после миграции всё
 * ещё открыты. Их закрывает отдельный проход:
 *   pnpm tsx scripts/backfill-media-visibility.ts
 * Миграция намеренно этого не делает: пометить нужно только те файлы, на
 * которые ссылаются записи звонков и сообщения, а это обход коллекций, а не
 * один UPDATE.
 *
 * ON DELETE SET NULL, а не CASCADE: удаление пациента не должно уносить файл
 * записи приёма - он остаётся у врача и организации.
 *
 * Все шаги идемпотентны, поэтому миграция безопасно проходит и на базе, где
 * схему уже создал dev push.
 */

/** Имена индексов - как их генерирует сам Payload для `index: true`. */
const VISIBILITY_INDEX = 'media_visibility_idx'
const ALLOWED_USER_INDEX = 'media_allowed_user_idx'
const ALLOWED_DOCTOR_INDEX = 'media_allowed_doctor_idx'

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // --- Шаг 1: нужные таблицы должны существовать.
  const tables = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('media', 'users', 'doctors')
  `)

  const present = new Set(tables.rows.map((row) => (row as { table_name: string }).table_name))
  for (const table of ['media', 'users', 'doctors']) {
    if (!present.has(table)) {
      throw new Error(
        `Таблица "${table}" не найдена. Запустите \`pnpm dev\` (dev push создаёт схему), затем \`pnpm migrate\`.`,
      )
    }
  }

  // --- Шаг 2: тип для select-поля.
  // CREATE TYPE не поддерживает IF NOT EXISTS, поэтому проверяем сами:
  // на базе после dev push тип уже есть.
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_media_visibility') THEN
        CREATE TYPE "enum_media_visibility" AS ENUM ('public', 'private');
      END IF;
    END $$
  `)

  // --- Шаг 3: колонки.
  await db.execute(sql`
    ALTER TABLE "media"
      ADD COLUMN IF NOT EXISTS "visibility" "enum_media_visibility" DEFAULT 'public',
      ADD COLUMN IF NOT EXISTS "allowed_user_id" integer,
      ADD COLUMN IF NOT EXISTS "allowed_doctor_id" integer
  `)

  // --- Шаг 4: внешние ключи.
  // Имена - как у Payload; ADD CONSTRAINT не умеет IF NOT EXISTS.
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'media_allowed_user_id_users_id_fk'
      ) THEN
        ALTER TABLE "media"
          ADD CONSTRAINT "media_allowed_user_id_users_id_fk"
          FOREIGN KEY ("allowed_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'media_allowed_doctor_id_doctors_id_fk'
      ) THEN
        ALTER TABLE "media"
          ADD CONSTRAINT "media_allowed_doctor_id_doctors_id_fk"
          FOREIGN KEY ("allowed_doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL;
      END IF;
    END $$
  `)

  // --- Шаг 5: индексы.
  // Правило доступа фильтрует по всем трём полям на каждой отдаче файла.
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ${sql.raw(`"${VISIBILITY_INDEX}"`)} ON "media" ("visibility")
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ${sql.raw(`"${ALLOWED_USER_INDEX}"`)} ON "media" ("allowed_user_id")
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ${sql.raw(`"${ALLOWED_DOCTOR_INDEX}"`)} ON "media" ("allowed_doctor_id")
  `)

  payload.logger.info(
    '[migration] media.visibility: колонки готовы. Записи приёмов, загруженные ранее, ' +
      'закройте проходом: pnpm tsx scripts/backfill-media-visibility.ts',
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS ${sql.raw(`"${VISIBILITY_INDEX}"`)}`)
  await db.execute(sql`DROP INDEX IF EXISTS ${sql.raw(`"${ALLOWED_USER_INDEX}"`)}`)
  await db.execute(sql`DROP INDEX IF EXISTS ${sql.raw(`"${ALLOWED_DOCTOR_INDEX}"`)}`)

  await db.execute(sql`
    ALTER TABLE "media"
      DROP CONSTRAINT IF EXISTS "media_allowed_user_id_users_id_fk",
      DROP CONSTRAINT IF EXISTS "media_allowed_doctor_id_doctors_id_fk"
  `)

  await db.execute(sql`
    ALTER TABLE "media"
      DROP COLUMN IF EXISTS "visibility",
      DROP COLUMN IF EXISTS "allowed_user_id",
      DROP COLUMN IF EXISTS "allowed_doctor_id"
  `)

  await db.execute(sql`DROP TYPE IF EXISTS "enum_media_visibility"`)
}
