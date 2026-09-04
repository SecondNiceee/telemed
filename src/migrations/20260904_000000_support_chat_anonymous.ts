import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Чат поддержки становится анонимным.
 *
 * Зачем
 * -----
 * Раньше перед первым вопросом посетитель заполнял форму: имя, телефон или
 * email и чекбокс согласия на обработку ПДн. Контакт был «на случай, если
 * закроет вкладку». На практике это лишний барьер перед простым вопросом, а
 * сами контакты — персональные данные, которые надо охранять, описывать в
 * политике и по которым надо уметь принимать отзыв согласия.
 *
 * Решение: данные не собирать вовсе. Посетитель пишет сразу, ответ приходит в
 * ту же вкладку по сокету, переписка восстанавливается по publicId из
 * localStorage. Нет ПДн — нет согласия, нечего защищать и нечего удалять.
 *
 * Что меняется в схеме
 * --------------------
 * - `visitor_contact`, `contact_kind`, `consent_at` удаляются вместе с enum-ом
 *   вида контакта. Существующие значения — контакты реальных людей, собранные
 *   под цель «ответить на обращение»; цель отпала, хранить их дальше нельзя
 *   (ч. 4 ст. 21 152-ФЗ), поэтому именно DROP, а не «оставим на всякий случай».
 * - `visitor_name` остаётся, но теперь это техническая метка «Посетитель #xxxx»,
 *   которую выдаёт сервер. Старые записи с настоящими именами обезличиваются
 *   тем же шаблоном по хвосту publicId — как для новых диалогов.
 *
 * Идемпотентна: DROP COLUMN / DROP TYPE под IF EXISTS, UPDATE только по строкам,
 * ещё не приведённым к шаблону.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "support_conversations"
    SET "visitor_name" = 'Посетитель #' || right("public_id", 4)
    WHERE "visitor_name" NOT LIKE 'Посетитель #%';
  `)

  await db.execute(sql`
    ALTER TABLE "support_conversations" DROP COLUMN IF EXISTS "visitor_contact";
  `)
  await db.execute(sql`
    ALTER TABLE "support_conversations" DROP COLUMN IF EXISTS "contact_kind";
  `)
  await db.execute(sql`
    ALTER TABLE "support_conversations" DROP COLUMN IF EXISTS "consent_at";
  `)
  await db.execute(sql`
    DROP TYPE IF EXISTS "enum_support_conversations_contact_kind";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Обратный ход только структурный: удалённые контакты восстановить неоткуда,
  // поэтому колонки возвращаются пустыми (nullable), а не NOT NULL как в
  // исходной миграции — иначе ALTER упал бы на существующих строках.
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_support_conversations_contact_kind') THEN
        CREATE TYPE "enum_support_conversations_contact_kind" AS ENUM ('phone', 'email');
      END IF;
    END $$;
  `)
  await db.execute(sql`
    ALTER TABLE "support_conversations" ADD COLUMN IF NOT EXISTS "visitor_contact" varchar;
  `)
  await db.execute(sql`
    ALTER TABLE "support_conversations"
      ADD COLUMN IF NOT EXISTS "contact_kind" "enum_support_conversations_contact_kind";
  `)
  await db.execute(sql`
    ALTER TABLE "support_conversations"
      ADD COLUMN IF NOT EXISTS "consent_at" timestamp(3) with time zone;
  `)
}
