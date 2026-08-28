import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Акцепт публичной оферты: группа `users.offerAcceptance`.
 *
 * Зачем
 * -----
 * Оферты у сервиса не было вообще: пользователь платил за консультацию, не
 * приняв никаких условий, - то есть договор был, но его содержание нигде не
 * зафиксировано. В споре о возврате денег или об объёме услуги ссылаться было
 * не на что ни одной из сторон.
 *
 * Соответствие имён (группа даёт префикс offer_acceptance_)
 * --------------------------------------------------------
 *   offerAcceptance.acceptedAt -> offer_acceptance_accepted_at
 *   offerAcceptance.version    -> offer_acceptance_version
 *   offerAcceptance.text       -> offer_acceptance_text
 *
 * Почему старым аккаунтам НЕ проставляется дата
 * ---------------------------------------------
 * Тот же принцип, что и в миграции согласия на ПДн: заполнить старые строки
 * задним числом означало бы создать запись о принятии договора, которого человек
 * не видел. Это не «починка данных», а подделка доказательства. NULL честно
 * означает «оферта не принята», и по этому признаку такие аккаунты можно найти и
 * запросить акцепт при следующем входе.
 *
 * Идемпотентна: каждый шаг под IF NOT EXISTS.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "offer_acceptance_accepted_at" timestamp(3) with time zone;
  `)

  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "offer_acceptance_version" varchar;
  `)

  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "offer_acceptance_text" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "offer_acceptance_text";`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "offer_acceptance_version";`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "offer_acceptance_accepted_at";`)
}
