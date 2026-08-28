import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Отзыв согласия на обработку персональных данных: заявка и протокол исполнения.
 *
 * Почему поля в таблице users, а не отдельная таблица заявок
 * ---------------------------------------------------------
 * Отзыв у аккаунта бывает один раз и необратим - истории тут не бывает по
 * определению, а значит отдельная таблица со связью не давала бы ничего, кроме
 * джойна. Существеннее другое: исполнение отзыва обезличивает запись
 * пользователя, но НЕ удаляет её. Поэтому сама запись users и остаётся носителем
 * доказательства - в ней сохраняются дата, версия и текст согласия, к которым
 * теперь добавляются дата отзыва и протокол. Отдельная таблица потребовалась бы
 * только при полном удалении строки пользователя, а этот путь отвергнут: он
 * уничтожает и доказательство согласия, и связи с платежами.
 *
 * Почему статус - enum, а не boolean «отозвано»
 * ---------------------------------------------
 * Состояний три, и среднее - главное. Между обращением пациента и исполнением
 * проходит время на рассмотрение, и «заявка поступила» надо отличать и от
 * «согласие действует», и от «данные уже обезличены». Boolean это состояние
 * скрыл бы, и заявки было бы негде увидеть.
 *
 * Почему DEFAULT 'none', а не NULL
 * --------------------------------
 * В отличие от IP акцепта (20260828_000002), где NULL означает честное «адрес не
 * определён», здесь у каждого существующего пользователя состояние определено
 * достоверно: согласие действует, отзыва не было. NULL пришлось бы трактовать
 * в коде как 'none', то есть завести второе значение с тем же смыслом.
 *
 * confirm_erasure с DEFAULT false, а не NULL - по той же причине: отметка
 * подтверждения либо проставлена администратором, либо нет, третьего состояния
 * у неё не бывает.
 *
 * Тип timestamp(3) with time zone и varchar для текста - как Payload генерирует
 * для полей `date` и `textarea`; иные типы разошлись бы со схемой.
 *
 * Идемпотентна: enum создаётся под проверкой pg_type, колонки - под
 * IF NOT EXISTS.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_users_data_processing_status') THEN
        CREATE TYPE "enum_users_data_processing_status" AS ENUM ('none', 'requested', 'revoked');
      END IF;
    END $$;
  `)

  await db.execute(sql`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "data_processing_status"
        "enum_users_data_processing_status" DEFAULT 'none';
  `)

  await db.execute(sql`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "data_processing_requested_at" timestamp(3) with time zone;
  `)

  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "data_processing_request_ip" varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "data_processing_confirm_erasure" boolean DEFAULT false;
  `)

  await db.execute(sql`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "data_processing_processed_at" timestamp(3) with time zone;
  `)

  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "data_processing_log" varchar;
  `)

  /**
   * Частичный индекс по заявкам.
   *
   * Администратору нужен один запрос - «есть ли необработанные заявки», и он
   * попадает в узкую долю строк. Полный индекс по статусу почти целиком состоял
   * бы из значения 'none', то есть из строк, которые никогда не ищут.
   */
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "users_data_processing_requested_idx"
      ON "users" ("data_processing_requested_at")
      WHERE "data_processing_status" = 'requested';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS "users_data_processing_requested_idx";`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "data_processing_log";`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "data_processing_processed_at";`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "data_processing_confirm_erasure";`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "data_processing_request_ip";`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "data_processing_requested_at";`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "data_processing_status";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_users_data_processing_status";`)
}
