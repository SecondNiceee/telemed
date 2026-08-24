import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Денормализованный рейтинг врача: `doctors.rating` + `doctors.reviews_count`.
 *
 * Зачем миграция
 * --------------
 * В dev схему догоняет push, но на VPS приложение поднимается через
 * `next start` и `pnpm migrate`. Без этих колонок хук пересчёта (см.
 * collections/helpers/doctor-rating.ts) писал бы в несуществующие поля, и
 * сохранение отзыва падало бы уже после того, как пациент поставил оценку.
 *
 * Соответствие имён
 * -----------------
 *   rating       -> rating        (numeric, NULL = отзывов нет)
 *   reviewsCount -> reviews_count (numeric, DEFAULT 0)
 *
 * Backfill
 * --------
 * Отзывы в базе уже есть, а рейтинг у врачей — нет. Проставляем его одним
 * UPDATE...FROM с агрегатом по feedbacks: это ровно то же среднее, что потом
 * считает хук, только сразу по всем врачам и без прохода через приложение.
 *
 * Все шаги идемпотентны, поэтому миграция безопасно проходит и на базе, где
 * схему уже создал dev push.
 */

/**
 * Индекс под сортировку врачей по рейтингу. Имя — как его генерирует сам
 * Payload для `index: true`, иначе dev push создал бы второй такой же.
 */
const RATING_INDEX = 'doctors_rating_idx'

/**
 * Индекс по врачу в отзывах. Пересчёт рейтинга выбирает отзывы одного врача
 * (`where: { doctor: { equals } }`), и без индекса каждый новый отзыв означал
 * бы Seq Scan по всей таблице отзывов.
 */
const FEEDBACKS_DOCTOR_INDEX = 'feedbacks_doctor_idx'

export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  // --- Шаг 1: обе таблицы должны существовать.
  const tables = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('doctors', 'feedbacks')
  `)

  const present = new Set(tables.rows.map((row) => (row as { table_name: string }).table_name))
  for (const table of ['doctors', 'feedbacks']) {
    if (!present.has(table)) {
      throw new Error(
        `Таблица "${table}" не найдена. Запустите \`pnpm dev\` (dev push создаёт схему), затем \`pnpm migrate\`.`,
      )
    }
  }

  // --- Шаг 2: сами колонки.
  // rating без DEFAULT и nullable: «отзывов нет» — это NULL, а не 0. Ноль
  // поставил бы нового врача ниже врача с единственной оценкой «1».
  await db.execute(sql`
    ALTER TABLE "doctors"
      ADD COLUMN IF NOT EXISTS "rating" numeric,
      ADD COLUMN IF NOT EXISTS "reviews_count" numeric DEFAULT 0
  `)

  // --- Шаг 3: backfill по уже существующим отзывам.
  // Округление до двух знаков — как в хуке (RATING_DECIMALS), чтобы значения
  // от миграции и от приложения не отличались форматом.
  const backfilled = await db.execute(sql`
    UPDATE "doctors" AS d
    SET "rating" = agg.avg_rating,
        "reviews_count" = agg.total
    FROM (
      SELECT doctor_id,
             ROUND(AVG("rating")::numeric, 2) AS avg_rating,
             COUNT(*) AS total
      FROM "feedbacks"
      WHERE doctor_id IS NOT NULL AND "rating" IS NOT NULL
      GROUP BY doctor_id
    ) AS agg
    WHERE d."id" = agg.doctor_id
      -- Повторный прогон не нужен, но и не навредит: пересчёт совпадёт.
      AND (d."rating" IS DISTINCT FROM agg.avg_rating
           OR d."reviews_count" IS DISTINCT FROM agg.total)
  `)

  // Врачи без отзывов: reviews_count должен быть 0, а не NULL — DEFAULT
  // применяется только к новым строкам, существующие остались бы пустыми.
  await db.execute(sql`
    UPDATE "doctors" SET "reviews_count" = 0 WHERE "reviews_count" IS NULL
  `)

  // --- Шаг 4: индексы.
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ${sql.raw(`"${RATING_INDEX}"`)} ON "doctors" ("rating")
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ${sql.raw(`"${FEEDBACKS_DOCTOR_INDEX}"`)}
    ON "feedbacks" (doctor_id)
  `)

  payload.logger.info(
    `[migration] doctors.rating: колонки готовы, рейтинг проставлен врачам: ${backfilled.rowCount ?? 0}`,
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS ${sql.raw(`"${RATING_INDEX}"`)}`)
  await db.execute(sql`DROP INDEX IF EXISTS ${sql.raw(`"${FEEDBACKS_DOCTOR_INDEX}"`)}`)

  await db.execute(sql`
    ALTER TABLE "doctors"
      DROP COLUMN IF EXISTS "rating",
      DROP COLUMN IF EXISTS "reviews_count"
  `)
}
