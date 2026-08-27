import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Закрывает уже загруженные записи консультаций и вложения чатов.
 *
 * Почему понадобилась вторая миграция. Первая (20260827_000000) добавила
 * колонку как `ADD COLUMN visibility ... DEFAULT 'public'`, и Postgres
 * проставил это значение всем существующим строкам. Расчёт был на то, что у
 * старых записей окажется NULL, а разметку доделает scripts/backfill-media-
 * visibility.ts. Вышло наоборот: 74 файла, включая 19 записей приёмов, были
 * явно помечены публичными - проверка на проде показала, что видео приёма
 * скачивалось без авторизации (HTTP 206, video/webm).
 *
 * Поэтому разметка выполняется здесь, на SQL, а не отдельным скриптом: шаг
 * деплоя, который надо не забыть запустить руками, - это тот же самый способ
 * снова остаться с открытыми записями.
 *
 * Публичные файлы (фото врачей, иконки категорий) не затрагиваются: UPDATE
 * ограничен теми id, на которые ссылаются call_recordings.video_id и
 * messages.attachment_id.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Записи консультаций: доступ у пациента из консультации и у лечащего врача.
  // Врач берётся из самой записи, а при отсутствии - из консультации.
  await db.execute(sql`
    UPDATE "media" AS m
    SET "visibility" = 'private',
        "allowed_user_id" = a."user_id",
        "allowed_doctor_id" = COALESCE(cr."doctor_id", a."doctor_id")
    FROM "call_recordings" AS cr
    LEFT JOIN "appointments" AS a ON a."id" = cr."appointment_id"
    WHERE m."id" = cr."video_id"
  `)

  // Вложения чатов: доступ у обоих участников переписки.
  await db.execute(sql`
    UPDATE "media" AS m
    SET "visibility" = 'private',
        "allowed_user_id" = a."user_id",
        "allowed_doctor_id" = a."doctor_id"
    FROM "messages" AS ms
    LEFT JOIN "appointments" AS a ON a."id" = ms."appointment_id"
    WHERE m."id" = ms."attachment_id"
  `)

  // Подстраховка на случай, если запись консультации потеряла связь с
  // приёмом: без известных участников открытой её оставлять нельзя - пусть
  // остаётся доступной только админу.
  await db.execute(sql`
    UPDATE "media"
    SET "visibility" = 'private'
    WHERE "visibility" <> 'private'
      AND ("filename" LIKE 'consultation-%' OR "alt" LIKE 'Запись консультации%')
  `)
}

/**
 * Откат возвращает файлы в публичное состояние.
 *
 * Это осознанно опасная операция: она снова открывает записи приёмов. Нужна
 * только чтобы миграция была обратимой; выполнять её на реальных данных не
 * следует.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "media"
    SET "visibility" = 'public',
        "allowed_user_id" = NULL,
        "allowed_doctor_id" = NULL
    WHERE "visibility" = 'private'
  `)
}
