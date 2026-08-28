import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Реквизиты оператора персональных данных (юрлица платформы) в `site_settings`.
 *
 * Зачем
 * -----
 * До этой миграции реквизиты платформы были константой в коде
 * (`src/lib/legal/operator.ts`) со значениями `___`. Их правка требовала
 * редактирования кода и деплоя, поэтому смена адреса или телефона для обращений
 * по персональным данным означала бы, что Политика, Оферта и Согласие печатают
 * устаревший контакт до следующего релиза. Ст. 18.1 152-ФЗ требует, чтобы
 * оператор был назван и доступен для обращений, а не «был назван на момент
 * прошлой сборки».
 *
 * Почему в site_settings, а не в organisations
 * -------------------------------------------
 * Операторов в системе два: платформа отвечает за данные аккаунта, клиника - за
 * данные о здоровье. Реквизиты клиник уже лежат в `organisations` (см.
 * 20260827_000004) и заполняются самими клиниками. Эти колонки - про платформу,
 * и смешивать их нельзя: тогда в согласии на консультацию оператором данных о
 * здоровье оказалось бы не то лицо.
 *
 * Почему всё nullable и без DEFAULT
 * ---------------------------------
 * По той же причине, что и в реквизитах клиник: любое значение по умолчанию тут
 * стало бы выдумкой в поле, попадающем в юридический документ. NULL честно
 * значит «не заполнено», и страницы показывают пометку «черновик» и закрываются
 * от индексации, вместо того чтобы называть оператором неизвестно кого.
 *
 * Даты редакций документов (PDN_CONSENT_VERSION, OFFER_VERSION) в БД намеренно
 * НЕ переносятся: они привязаны к тексту, и правка даты в админке объявила бы
 * новую редакцию документа, которого никто не переписывал.
 *
 * Идемпотентна: каждый шаг под IF NOT EXISTS.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Если таблицы глобала ещё нет, выходим молча: значит база создаётся с нуля и
  // Payload заведёт `site_settings` уже с этими колонками по актуальной схеме.
  // Создавать здесь таблицу-заглушку было бы хуже - в базе появился бы объект с
  // одним `id`, не совпадающий ни с одной версией схемы.
  const exists = await db.execute(
    sql`SELECT to_regclass('public.site_settings') IS NOT NULL AS present;`,
  )
  const rows = (exists as unknown as { rows?: { present?: boolean }[] }).rows
  if (!rows?.[0]?.present) return

  await db.execute(sql`
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "operator_legal_name" varchar;
  `)
  await db.execute(sql`ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "operator_inn" varchar;`)
  await db.execute(sql`ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "operator_ogrn" varchar;`)
  await db.execute(sql`
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "operator_address" varchar;
  `)
  await db.execute(sql`
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "operator_email" varchar;
  `)
  await db.execute(sql`
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "operator_phone" varchar;
  `)
  await db.execute(sql`
    ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "operator_hosting_location" varchar;
  `)
  // DEFAULT false здесь уместен, в отличие от текстовых полей: «уведомление не
  // подано» - это не выдумка, а исходное состояние, и код на флаг не опирается.
  await db.execute(sql`
    ALTER TABLE "site_settings"
      ADD COLUMN IF NOT EXISTS "operator_rkn_notification_submitted" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "operator_rkn_notification_submitted";
  `)
  await db.execute(sql`
    ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "operator_hosting_location";
  `)
  await db.execute(sql`ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "operator_phone";`)
  await db.execute(sql`ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "operator_email";`)
  await db.execute(sql`ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "operator_address";`)
  await db.execute(sql`ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "operator_ogrn";`)
  await db.execute(sql`ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "operator_inn";`)
  await db.execute(sql`ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "operator_legal_name";`)
}
