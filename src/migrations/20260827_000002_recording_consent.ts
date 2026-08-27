import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Согласие пациента на запись консультации: группа `appointments.recordingConsent`.
 *
 * Зачем
 * -----
 * Запись стартовала автоматически по жизненному циклу комнаты, и пациент об
 * этом не узнавал: в интерфейсе звонка не было ни предупреждения, ни выбора.
 * Согласие должно быть информированным и конкретным, поэтому решение теперь
 * хранится рядом с самой консультацией.
 *
 * Соответствие имён (группа даёт префикс recording_consent_)
 * ----------------------------------------------------------
 *   recordingConsent.status      -> recording_consent_status
 *   recordingConsent.decidedAt   -> recording_consent_decided_at
 *   recordingConsent.consentText -> recording_consent_consent_text
 *
 * Почему DEFAULT 'pending' здесь безопасен
 * ----------------------------------------
 * В миграции media колонка visibility создавалась с DEFAULT 'public', и это
 * стало ошибкой: Postgres проставил значение всем существующим строкам, то
 * есть уже загруженные записи получили метку «публичный» и утечка сохранилась.
 * Здесь ситуация обратная. Значение по умолчанию 'pending' означает «не
 * спрашивали», а запись при нём НЕ стартует. Старые консультации получают
 * состояние, которое запись запрещает, - поведение по умолчанию закрывающее,
 * а не открывающее, и отдельной разметки данных не требуется.
 *
 * Идемпотентна: каждый шаг под IF NOT EXISTS, поэтому повторный запуск и
 * запуск на базе, где схему уже создал dev push, безопасны.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_appointments_recording_consent_status') THEN
        CREATE TYPE "enum_appointments_recording_consent_status" AS ENUM ('pending', 'granted', 'declined');
      END IF;
    END $$;
  `)

  await db.execute(sql`
    ALTER TABLE "appointments"
      ADD COLUMN IF NOT EXISTS "recording_consent_status"
        "enum_appointments_recording_consent_status" DEFAULT 'pending';
  `)

  await db.execute(sql`
    ALTER TABLE "appointments"
      ADD COLUMN IF NOT EXISTS "recording_consent_decided_at" timestamp(3) with time zone;
  `)

  await db.execute(sql`
    ALTER TABLE "appointments"
      ADD COLUMN IF NOT EXISTS "recording_consent_consent_text" varchar;
  `)

  // Строки, созданные до появления колонки, получают явное 'pending'. DEFAULT
  // закрывает только новые вставки, а NULL в проверке согласия пришлось бы
  // трактовать отдельно - лучше не оставлять третьего состояния.
  await db.execute(sql`
    UPDATE "appointments"
    SET "recording_consent_status" = 'pending'
    WHERE "recording_consent_status" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "appointments" DROP COLUMN IF EXISTS "recording_consent_consent_text";
  `)
  await db.execute(sql`
    ALTER TABLE "appointments" DROP COLUMN IF EXISTS "recording_consent_decided_at";
  `)
  await db.execute(sql`
    ALTER TABLE "appointments" DROP COLUMN IF EXISTS "recording_consent_status";
  `)
  await db.execute(sql`
    DROP TYPE IF EXISTS "enum_appointments_recording_consent_status";
  `)
}
