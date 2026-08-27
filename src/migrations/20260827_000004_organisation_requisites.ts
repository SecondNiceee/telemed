import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Юридические реквизиты медицинской организации: колонки в `organisations`.
 *
 * Зачем
 * -----
 * По медицинским данным оператор - клиника, а платформа обрабатывает их по её
 * поручению (ч. 3 ст. 6 152-ФЗ). Согласие обязано называть конкретного
 * оператора (п. 3 ч. 4 ст. 9 152-ФЗ), а до этой миграции в коллекции были
 * только `name` и `support_phone`: подставить в текст согласия было нечего.
 *
 * Поэтому колонки не «на будущее». Без них согласие на консультацию не может
 * назвать того, кто отвечает за данные о здоровье, и модель «клиника -
 * оператор, платформа - обработчик» существует только на словах.
 *
 * Почему всё nullable и без DEFAULT
 * ---------------------------------
 * Реквизиты знает только сама клиника. Любое значение по умолчанию здесь было
 * бы выдумкой в поле, которое потом попадёт в юридический документ. NULL честно
 * означает «клиника ещё не заполнила», и по этому признаку такие организации
 * можно найти и не показывать их врачей как готовых к приёму.
 *
 * Идемпотентна: каждый шаг под IF NOT EXISTS.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "legal_name" varchar;`)
  await db.execute(sql`ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "inn" varchar;`)
  await db.execute(sql`ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "ogrn" varchar;`)
  await db.execute(sql`ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "legal_address" varchar;`)
  await db.execute(sql`ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "privacy_email" varchar;`)
  await db.execute(sql`ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "licence_number" varchar;`)
  await db.execute(sql`ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "licence_issued_by" varchar;`)
  await db.execute(sql`
    ALTER TABLE "organisations"
      ADD COLUMN IF NOT EXISTS "licence_issued_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "organisations" DROP COLUMN IF EXISTS "licence_issued_at";`)
  await db.execute(sql`ALTER TABLE "organisations" DROP COLUMN IF EXISTS "licence_issued_by";`)
  await db.execute(sql`ALTER TABLE "organisations" DROP COLUMN IF EXISTS "licence_number";`)
  await db.execute(sql`ALTER TABLE "organisations" DROP COLUMN IF EXISTS "privacy_email";`)
  await db.execute(sql`ALTER TABLE "organisations" DROP COLUMN IF EXISTS "legal_address";`)
  await db.execute(sql`ALTER TABLE "organisations" DROP COLUMN IF EXISTS "ogrn";`)
  await db.execute(sql`ALTER TABLE "organisations" DROP COLUMN IF EXISTS "inn";`)
  await db.execute(sql`ALTER TABLE "organisations" DROP COLUMN IF EXISTS "legal_name";`)
}
