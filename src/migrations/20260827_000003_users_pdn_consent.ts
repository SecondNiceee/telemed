import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Отметка о согласии на обработку персональных данных: группа `users.pdnConsent`.
 *
 * Зачем
 * -----
 * До этого согласие на обработку ПДн не собиралось вообще: при регистрации не
 * было ни чекбокса, ни документа, ни следа в базе. Обработка данных о здоровье
 * без согласия - основание для претензии сама по себе, а доказать согласие
 * нечем, если оно нигде не зафиксировано.
 *
 * Соответствие имён (группа даёт префикс pdn_consent_)
 * ---------------------------------------------------
 *   pdnConsent.acceptedAt -> pdn_consent_accepted_at
 *   pdnConsent.version    -> pdn_consent_version
 *   pdnConsent.text       -> pdn_consent_text
 *
 * Почему без DEFAULT и без заполнения старых строк
 * ------------------------------------------------
 * Здесь нельзя повторить ошибку миграции media, где DEFAULT 'public' проставил
 * значение всем существующим строкам. Но нельзя и «починить» старые аккаунты,
 * проставив им дату: это была бы запись о согласии, которого пользователь не
 * давал - хуже, чем пустое поле. NULL честно означает «согласие не собрано»,
 * и по этому признаку такие аккаунты можно найти и запросить согласие.
 *
 * Идемпотентна: каждый шаг под IF NOT EXISTS.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "pdn_consent_accepted_at" timestamp(3) with time zone;
  `)

  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pdn_consent_version" varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pdn_consent_text" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "pdn_consent_text";`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "pdn_consent_version";`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "pdn_consent_accepted_at";`)
}
