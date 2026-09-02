import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Таблицы чата поддержки: диалоги посетителей и сообщения в них.
 *
 * Схема снята с самого Payload, а не написана по памяти: типы колонок, имена
 * enum-ов, индексов и внешнего ключа получены прогоном `init()` адаптера
 * db-postgres на реальном конфиге. Отсюда две неочевидные вещи, которые при
 * ручном написании почти наверняка разошлись бы с ожиданиями Payload и дали бы
 * на проде `column ... does not exist`:
 *
 * 1. Поля типа `number` (`telegramTopicId`, `telegramMessageId`) Payload
 *    отображает в `numeric`, а НЕ в `integer` — несмотря на то, что хранятся
 *    там целые идентификаторы Telegram.
 * 2. Колонка связи называется `conversation_id`, а вот индекс по ней —
 *    `support_messages_conversation_idx`, без суффикса `_id`. Имена колонки и
 *    индекса строятся по разным правилам.
 *
 * Почему таблицы создаёт миграция, а не push-режим Payload: на проде схему
 * догоняет только `pnpm migrate` (dev-push там не работает), и без этого файла
 * рабочий код чата упал бы на первом же обращении к несуществующей таблице.
 *
 * Идемпотентна: таблицы и индексы под `IF NOT EXISTS`, enum-ы под проверкой
 * `pg_type` (CREATE TYPE не поддерживает `IF NOT EXISTS`).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_support_conversations_contact_kind') THEN
        CREATE TYPE "enum_support_conversations_contact_kind" AS ENUM ('phone', 'email');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_support_conversations_status') THEN
        CREATE TYPE "enum_support_conversations_status" AS ENUM ('open', 'closed');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_support_messages_sender') THEN
        CREATE TYPE "enum_support_messages_sender" AS ENUM ('visitor', 'operator');
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "support_conversations" (
      "id" serial PRIMARY KEY NOT NULL,
      "public_id" varchar NOT NULL,
      "visitor_name" varchar NOT NULL,
      "visitor_contact" varchar NOT NULL,
      "contact_kind" "enum_support_conversations_contact_kind" NOT NULL,
      "telegram_topic_id" numeric,
      "status" "enum_support_conversations_status" DEFAULT 'open' NOT NULL,
      "consent_at" timestamp(3) with time zone NOT NULL,
      "last_message_at" timestamp(3) with time zone,
      "page_url" varchar,
      "user_agent" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "support_messages" (
      "id" serial PRIMARY KEY NOT NULL,
      "conversation_id" integer NOT NULL,
      "sender" "enum_support_messages_sender" NOT NULL,
      "text" varchar NOT NULL,
      "telegram_message_id" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  /**
   * Внешний ключ с `ON DELETE CASCADE`, хотя Payload по умолчанию строит
   * `SET NULL`. Его вариант тут нерабочий: колонка `conversation_id` объявлена
   * `NOT NULL`, поэтому попытка удалить диалог из админки не обнулила бы связь,
   * а упала бы с нарушением ограничения — удалить диалог стало бы невозможно.
   * Каскад отвечает смыслу данных: сообщения не существуют отдельно от диалога.
   *
   * Имя констрейнта оставлено ровно как у Payload, иначе при следующей
   * генерации схемы он счёл бы ключ отсутствующим и создал второй.
   */
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'support_messages_conversation_id_support_conversations_id_fk'
      ) THEN
        ALTER TABLE "support_messages"
          ADD CONSTRAINT "support_messages_conversation_id_support_conversations_id_fk"
          FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id")
          ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  /**
   * `public_id` — уникальный индекс: он одновременно имя комнаты сокета и токен
   * доступа к переписке, и совпадение двух диалогов открыло бы чужую историю.
   */
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "support_conversations_public_id_idx"
      ON "support_conversations" ("public_id");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_conversations_telegram_topic_id_idx"
      ON "support_conversations" ("telegram_topic_id");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_conversations_status_idx"
      ON "support_conversations" ("status");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_conversations_last_message_at_idx"
      ON "support_conversations" ("last_message_at");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_conversations_updated_at_idx"
      ON "support_conversations" ("updated_at");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_conversations_created_at_idx"
      ON "support_conversations" ("created_at");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_messages_conversation_idx"
      ON "support_messages" ("conversation_id");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_messages_telegram_message_id_idx"
      ON "support_messages" ("telegram_message_id");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_messages_updated_at_idx"
      ON "support_messages" ("updated_at");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_messages_created_at_idx"
      ON "support_messages" ("created_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Сообщения — первыми: на них висит внешний ключ к диалогам.
  await db.execute(sql`DROP TABLE IF EXISTS "support_messages";`)
  await db.execute(sql`DROP TABLE IF EXISTS "support_conversations";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_support_messages_sender";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_support_conversations_status";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_support_conversations_contact_kind";`)
}
