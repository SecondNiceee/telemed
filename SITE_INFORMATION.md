# Структура проекта smartcardio (Телемедицина)

## Обзор системы

Платформа телемедицины на Next.js 15 (App Router) + Payload CMS 3 + PostgreSQL.

**Четыре типа пользователей:**

| Роль | Коллекция | Кабинет | Что делает |
|------|-----------|---------|------------|
| Пациент | `Users` (role: `user`) | `/lk` | Записывается на консультации, оплачивает, общается с врачом, оставляет отзывы |
| Врач | `Doctors` | `/lk-med` | Проводит консультации, звонки, ведёт чат |
| Организация | `Organisations` | `/lk-org` | Создаёт врачей, ведёт расписание, смотрит консультации и статистику |
| Админ | `Users` (role: `admin`) | `/admin` | Создаёт организации, первичная настройка, сидинг |

**Стек:**
- Next.js 15.4 / React 19, Tailwind CSS 4, shadcn-подобные UI-компоненты (`src/components/ui`)
- Payload CMS 3.76 + `@payloadcms/db-postgres`
- Zustand для клиентского состояния (`src/stores`)
- Socket.IO для чата и сигналинга звонков (отдельный процесс)
- MediaSoup (SFU) + PeerJS (P2P) для видеозвонков — переключаются флагом
- ЮKassa для оплаты консультаций
- Nodemailer (`@payloadcms/email-nodemailer`) для писем

---

## Процессы приложения

Проект запускается как несколько отдельных процессов:

| Скрипт | Файл | Порт (по умолчанию) | Назначение |
|--------|------|---------------------|------------|
| `pnpm dev` / `pnpm start` | Next.js | 3000 | Веб-приложение + Payload + API-роуты |
| `pnpm socket` | `src/server.ts` → `src/lib/socket/server.ts` | `SOCKET_PORT` | Socket.IO: чат, сигналинг, статусы |
| `pnpm mediasoup` | `src/mediasoup-server.ts` | `MEDIASOUP_PORT` | SFU-сервер видеозвонков + запись через FFmpeg |
| `pnpm peer` | `src/peer-server.ts` | `PEER_PORT` (3002) | PeerJS-сервер (legacy/fallback режим P2P) |

Прочие скрипты: `generate:types`, `generate:importmap`, `migrate*`, `seed`, `nginx:setup`, `test:int` (vitest), `test:e2e` (playwright).

---

## Коллекции и глобалы Payload

| Коллекция | Файл | Ключевые поля |
|-----------|------|---------------|
| `users` | `src/collections/Users.ts` | auth, `phone`, `name`, `role` (`user` / `admin`) |
| `doctors` | `src/collections/Doctors.ts` | auth, `name`, `organisation`, `categories`, `experience`, `degree`, `price`, `photo` + `photoOriginal`/`photoCrop`, `bio`, `education[]`, `services[]`, `slotDuration`, `schedule[]` (даты → слоты) |
| `organisations` | `src/collections/Organisations.ts` | auth, `name` |
| `doctor-categories` | `src/collections/DoctorCategories.ts` | `name`, `slug`, `description`, `icon`, `iconImage` |
| `appointments` | `src/collections/Appointments.ts` | `doctor`, `user`, `doctorName`, `userName`, `specialty`, `date`, `time`, `price`, `status`, `paymentExpiresAt`, `paidAt`, `payment` (группа ЮKassa), `connectionType`, `chatBlocked`, `recording`, `activeCall` (группа) |
| `messages` | `src/collections/Messages.ts` | `appointment`, `sender`, `isSystemMessage`, `text`, `attachment`, `read` |
| `call-recordings` | `src/collections/CallRecordings.ts` | `appointment`, `doctor`, `recordingType`, `video`, `durationSeconds`, `recordedAt` |
| `feedbacks` | `src/collections/Feedbacks.ts` | `user`, `doctor`, `appointment`, `rating`, `text` |
| `media` | `src/collections/Media.ts` | `alt` + upload (изображения, видео) |

**Глобал:** `site-settings` (`src/globals/SiteSettings.ts`) — `heroTitle`, `heroSubtitle`, `faq[]` (question/answer).

**Хелперы коллекций:** `src/collections/helpers/` (в т.ч. `auth.ts` → `getCallerFromRequest`), `src/utils/buildAppointmentAccessFilter.ts`.

**Миграции:** `src/migrations/` — уникальность слота (`appointments_slot_unique`) и поля оплаты (`appointments_payment_fields`).

---

## Роутинг

### Публичная часть

| Путь | Описание |
|------|----------|
| `/` | Главная: hero, категории, преимущества, ЭКГ-блоки, отзывы, FAQ |
| `/appointment` | Запись на приём: выбор специальности |
| `/category/[id]` | Врачи внутри категории (с пагинацией) |
| `/doctor/[id]` | Страница врача: инфо, отзывы, выбор слота, бронирование |
| `/appointment/[id]/payment` | Оплата консультации (ЮKassa) с таймером брони |
| `/verify-email` | Подтверждение email |
| `/reset-password` | Сброс пароля |

### Кабинет пациента

| Путь | Описание |
|------|----------|
| `/lk` | Главная ЛК: записи, баннер брони, приглашение оставить отзыв |
| `/lk/chat` | Чат с врачами (`?appointment={id}`) |

### Кабинет врача

| Путь | Описание |
|------|----------|
| `/lk-med` | Главная ЛК врача |
| `/lk-med/login` | Авторизация врача |
| `/lk-med/chat` | Чат с пациентами, звонки, завершение консультации |
| `/doctor-dashboard` | Дашборд врача (проверка `doctors-token`) |

### Кабинет организации

| Путь | Описание |
|------|----------|
| `/lk-org` | Список врачей + статистика, переход к настройкам организации |
| `/lk-org/settings` | Настройки организации: редактирование телефона поддержки |
| `/lk-org/consultations` | Все консультации врачей организации (`?sort=`), экспорт в XLSX |
| `/lk-org/consultation?id={appointmentId}` | Просмотр консультации: чат + записи звонков |
| `/lk-org/doctor/[id]` | Дашборд конкретного врача |
| `/lk-org/doctor-create` | Создание врача |
| `/lk-org/doctor-edit/[id]` | Редактирование врача |
| `/lk-org/doctor-schedule/[id]` | Расписание врача |
| `/lk-org/categories` | Категории врачей |
| `/lk-org/categories/create` | Создание категории |
| `/lk-org/categories/[id]/edit` | Редактирование категории |

### Админ

| Путь | Описание |
|------|----------|
| `/admin` | Собственная панель: первичная настройка (если БД пустая), логин, CRUD организаций, сидинг |
| `/cms` | Полная админка Payload (резервный инструмент, `routes.admin: '/cms'`) |

---

## API-роуты

### Аутентификация

| Endpoint | Описание |
|----------|----------|
| `POST /api/auth/register` | Регистрация пациента |
| `POST /api/users/logout` | Выход пациента |
| `POST /api/doctors/login` · `logout` · `GET /api/doctors/me` | Сессия врача |
| `POST /api/organisations/login` · `logout` · `GET /api/organisations/me` | Сессия организации |
| `POST /api/admin/login` | Вход админа |
| `POST /api/admin/setup` | Первичное создание админа (только на пустой базе) |

### Админ / организации

| Endpoint | Описание |
|----------|----------|
| `GET/POST /api/admin/organisations` | Список / создание организаций |
| `PATCH/DELETE /api/admin/organisations/[id]` | Изменение / удаление |
| `PATCH /api/admin/organisations/[id]/password` | Смена пароля организации |
| `POST /api/admin/seed` | Сидинг демо-данных |
| `POST /api/organisations/categories/create` · `/[id]` | CRUD категорий врачей |

### Консультации и оплата

| Endpoint | Описание |
|----------|----------|
| `POST /api/appointments/[id]/pay` | Создание платежа в ЮKassa, выдача `confirmation_url` |
| `GET /api/appointments/[id]/payment-status` | Синхронизация статуса платежа |
| `POST /api/appointments/[id]/release` | Освобождение брони (отказ от оплаты) |
| `POST /api/appointments/[id]/complete` | Завершение консультации |
| `POST /api/payments/yookassa/notification` | Webhook ЮKassa (проверка IP по `yookassa-ips`) |

### Записи звонков и прочее

| Endpoint | Описание |
|----------|----------|
| `POST /api/recording-chunks` | Прием chunk видео (PeerJS-режим) |
| `POST /api/recording-chunks/finalize` | Склейка chunks → `Media` + `CallRecording` |
| `POST /api/mediasoup-recording/finalize` | Финализация записи MediaSoup |
| `POST /api/mediasoup-recording/finalize-server` | Серверная финализация (вызов от mediasoup-процесса) |
| `POST /api/revalidate` | Ревалидация кэша (`REVALIDATION_SECRET`) |

---

## Аутентификация и доступ

**Cookies (JWT, HttpOnly, SameSite=Lax, 7 дней):**

| Cookie | Коллекция | Кто |
|--------|-----------|-----|
| `payload-token` | `users` | Пациенты и админы |
| `doctors-token` | `doctors` | Врачи |
| `organisations-token` | `organisations` | Организации |

**Хелперы:**
- `src/lib/auth-cookies.ts` — `buildSetCookie`, `buildClearCookie`, `signCollectionToken`, `extractCookie`
- `src/lib/auth/getSessionFromCookie.ts` — сессия по произвольной cookie/коллекции
- `src/lib/auth/adminSession.ts` — `getAdminFromCookieHeader` (с `jwt.verify`), `hasAnyUser`
- `src/lib/server/route-auth.ts` — `getUserFromCookies` и подобное для route handlers
- `src/lib/server/payload-jwt-secret.ts` — секрет для подписи/проверки токенов

**Access control:** правила в поле `access` каждой коллекции. Организация видит данные своих врачей, врач — только свои консультации, пациент — только свои данные.

---

## Оплата консультации (ЮKassa)

**Модель брони:** после выбора слота создаётся `Appointment` со статусом `pending_payment` и `paymentExpiresAt = now + 15 мин` (`src/lib/constants/payment.ts`). Слот занят, но не подтверждён.

**Поток:**
```
1. Пациент выбирает слот на /doctor/[id]
   └── Appointment (status: pending_payment, paymentExpiresAt)
   └── Уникальный индекс слота не даёт двойной брони

2. Редирект на /appointment/[id]/payment
   └── Таймер брони (formatPaymentCountdown)
   └── POST /api/appointments/[id]/pay → ЮKassa → confirmation_url

3. Пациент платит на стороне ЮKassa
   └── Webhook POST /api/payments/yookassa/notification
   └── Либо возврат на страницу → GET /payment-status (синхронизация)

4. Оплата succeeded
   └── status: confirmed, paidAt, payment.* заполняются сервером

5. Оплата не пройдена / истёк срок
   └── releaseHold() возвращает слот в расписание
   └── Фоновый sweeper (onInit в payload.config.ts) чистит просроченные брони
```

**Файлы:**

| Файл | Назначение |
|------|------------|
| `src/lib/server/yookassa.ts` | Низкоуровневый клиент API v3 (авторизация, идемпотентность, ошибки) |
| `src/lib/server/appointment-payments.ts` | Бизнес-логика: создание платежа, `syncAppointmentPayment` |
| `src/lib/server/appointment-holds.ts` | Броня слота, `releaseHold`, `startExpiredHoldsSweeper` |
| `src/lib/constants/payment.ts` | Окно оплаты, таймер, дедлайн |
| `src/lib/constants/yookassa-ips.ts` + `src/lib/server/ip-range.ts` | Валидация IP webhook'а |
| `src/components/appointment-countdown-banner.tsx` | Баннер «оплатите бронь» в ЛК |

**Важно:** поля группы `payment` не входят ни в один whitelist `appointment-booking-guard`, поэтому клиент и врач их не пишут — только серверный код.

---

## Видеозвонки

Два транспорта, переключение через `NEXT_PUBLIC_USE_MEDIASOUP`:

| Режим | Провайдер | Хук соединения |
|-------|-----------|----------------|
| MediaSoup (SFU, основной) | `video-call-provider-mediasoup.tsx` | `use-mediasoup-connection.ts` |
| PeerJS (P2P, legacy) | `video-call-provider.tsx` | `use-peer-connection.ts` |

Выбор делает `video-call-provider-wrapper.tsx`.

**Представления (`src/components/video-call/views/`):** `CallingView`, `IncomingCallView`, `ConnectingView`, `ConnectedView`, `MinimizedView`, `SavingView`.

**UI (`src/components/video-call/components/`):** `LocalVideo`, `RemoteVideo`, `CallControls`, `DoctorControls`, `CallTimer`, `ConnectionQuality`, `EndCallDialog`. Оверлей — `video-call-overlay.tsx`.

**Хуки (`src/components/video-call/hooks/`):** `use-media-stream`, `use-call-timer`, `use-connection-quality`, `use-call-recording`, `use-turn-test`.

**Серверная часть MediaSoup (`src/lib/mediasoup/`):** `worker-manager.ts` (пул воркеров с диапазоном TCP/UDP-портов), `peer.ts` и `room.ts` (идемпотентный lifecycle комнат, transports/producers/consumers), `handlers/signaling.ts` (защищённый Socket.IO-протокол), `room-token.ts` (короткоживущий JWT), `recorder.ts` (запись через FFmpeg), `config.ts`, `client-types.ts`. Токен участника выдаёт `POST /api/mediasoup/token`; leave beacon принимает MediaSoup-процесс по `POST /rooms/appointment_<id>/leave`.

**Конфиг клиента:** `src/lib/video-call/config.ts` — ICE/TURN (Metered), таймауты звонка, media constraints, пороги таймера.

### Запись звонков

**MediaSoup-режим:** поток пишется на сервере (FFmpeg, `RECORDING_OUTPUT_DIR`), затем `POST /api/mediasoup-recording/finalize(-server)` создаёт `Media` + `CallRecording`.

**PeerJS-режим (chunks):** `useCallRecording` каждые ~30 сек отправляет chunk в `POST /api/recording-chunks`; при завершении `finalize` склеивает их. Так при закрытии вкладки теряются только последние 30 секунд.

Логи записи — с префиксом `[Recording]`.

---

## Чат (Socket.IO)

**Сервер:** `src/server.ts` → `src/lib/socket/server.ts`.

| Часть | Файлы |
|-------|-------|
| Хендлеры | `handlers/`: `joinRoom`, `leaveRoom`, `sendMessage`, `markRead`, `typing`, `stopTyping`, `call`, `consultation`, `disconnect` |
| Middleware | `middleware/authMiddleware.ts` (проверка токена из cookie) |
| Стор | `stores/activeCallsStore.ts` |
| Утилиты | `verifyToken`, `verifyAppointmentAccess`, `validateMessageText`, `isValidAppointmentId`, `isValidSenderType`, `isRateLimited`, `getCookieValue` |
| Rate limit | `config/rate-limit.config.ts` |

**Клиент:** `src/components/socket-provider.tsx`.

**��омпоненты чата (`src/components/chat/`):** `chat-page`, `chat-sidebar`, `chat-window`, `doctor-chat-wrapper`, `message-bubble`, `components/` (`chat-header`, `chat-input`, `chat-messages`, `consultation-dialogs`, `drag-drop-overlay`, `video-save-sidebar`), `hooks/` (`use-file-upload`, `use-typing`).

**Типы сообщений:** обычные (пузырёк слева/справа) и системные (`isSystemMessage: true`) — по центру с линиями.

**Предпочтительный тип связи (`connectionType`):** `chat` / `audio` / `video`. Выбирается при записи, меняется в чате пациента — при смене создаётся системное сообщение.

### Завершение консультации и блокировка чата

1. Врач нажимает «Завершить консультацию» → `AlertDialog` (`ConsultationDialogs`)
2. `endConsultation(appointmentId)` через socket → статус `completed` → событие `consultation-ended` всем участникам
3. Чат остаётся открытым; появляется кнопка «Запретить пациенту писать» (`chat-block` / `chat-unblock` → поле `chatBlocked`)
4. Врач может писать всегда, независимо от блокировки

Из видеозвонка: `endCall()` → `stopRecording()` → финализация записи → `AppointmentsApi.complete()` → статус `completed`.

---

## Отзывы

Коллекция `feedbacks` (`user`, `doctor`, `appointment`, `rating`, `text`).

| Файл | Назначение |
|------|------------|
| `src/lib/api/feedbacks.ts` | API отзывов |
| `src/stores/feedback-store.ts` | Клиентское состояние |
| `src/components/feedback-dialog.tsx` | Форма отзыва |
| `src/components/feedback-prompt.tsx` | Приглашение оставить отзыв после консультации |
| `src/components/doctor-reviews.tsx` | Отзывы на странице врача |
| `src/components/reviews-section.tsx` | Блок отзывов на главной |

---

## API-клиенты (`src/lib/api/`)

| Файл | Описание |
|------|----------|
| `fetch.ts` | Базовые fetch-функции (клиент + сервер) |
| `errors.ts` | Обработка ошибок API |
| `auth.ts` · `doctor-auth.ts` · `org-auth.ts` | Авторизация пациентов / врачей / организаций |
| `doctors.ts` | Врачи |
| `appointments.ts` | Консультации (в т.ч. `complete`, `fetchByDoctorsServer`) |
| `messages.ts` | Сообщения |
| `call-recordings.ts` | Записи звонков |
| `categories.ts` / `categories.server.ts` | Категории (клиент / локальный Payload) |
| `site-settings.ts` / `site-settings.server.ts` | Настройки сайта |
| `feedbacks.ts` | Отзывы |
| `media-uploads.ts` | Загрузка файлов |
| `actions.ts` | Server actions |
| `types.ts` · `index.ts` | Типы и реэкспорты |

---

## Прочие библиотеки и утилиты

| Файл | Назначение |
|------|------------|
| `src/lib/export-consultations.ts` | Экспорт консультаций в XLSX (`xlsx-js-style`) |
| `src/lib/generate-password.ts` | Генерация паролей (создание врача/организации) |
| `src/lib/media-dir.ts` | Путь к каталогу медиа (`MEDIA_DIR`) |
| `src/lib/navigation-history.ts` | История навигации для кнопки «Назад» |
| `src/lib/constants/nav-sections.ts` | Секции навигации |
| `src/lib/utils/date.ts` · `consultation-duration.ts` · `categoryIcon.tsx` | Даты, длительность, иконки категорий |
| `src/utils/phone.ts` | Нормализация телефона |
| `src/utils/sendAppointmentEmail.ts` · `sendVerificationEmail.ts` · `buildResetPasswordEmail.ts` | Письма |
| `src/lib/seed/mock-data.ts` · `mock-bulk-doctors.ts` | Демо-данные для сидинга |

**Zustand-сторы (`src/stores/`):** `user-store`, `doctor-store`, `org-store`, `categories-store`, `chat-store`, `call-store`, `feedback-store`, `user-appointments-store`, `doctor-appointments-store`.

**Скрипты (`scripts/`):** `seed-all.ts`, `seed-data.config.ts`, `create-admin.ts`, `create-organisation.ts`, `create-doctors.ts`, `create-categories.ts`, `create-users.ts`, `setup-nginx.sh`, `test-turn-server.sh`, `gen-lockfile.js`.

---

## Статистика организации

На `/lk-org` показываются карточки:

| Счётчик | Логика |
|---------|--------|
| Всего консультаций | Все консультации врачей организации, кроме `cancelled` |
| Предстоящих | `confirmed` + дата в будущем |
| Прошедших | `completed` или дата в прошлом |

Данные фетчатся на сервере в `page.tsx` через `AppointmentsApi.fetchByDoctorsServer()` и передаются в `LkOrgContent` как `initialStats`.

---

## Переменные окружения

**Базовые:** `DATABASE_URL`, `PAYLOAD_SECRET`, `SERVER_URL`, `NEXTJS_URL`, `NODE_ENV`, `MEDIA_DIR`, `REVALIDATION_SECRET`, `DISABLE_HOLDS_SWEEPER`

**Почта:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`

**ЮKassa:** `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`, `YOOKASSA_PAYMENT_MODE`, `YOOKASSA_PAYMENT_SUBJECT`, `YOOKASSA_SEND_RECEIPT`, `YOOKASSA_VAT_CODE`, `YOOKASSA_NOTIFICATION_IPS`, `YOOKASSA_TRUST_ALL_IPS`

**Socket.IO:** `SOCKET_PORT`, `SOCKET_PATH`, `SOCKET_ALLOWED_ORIGINS`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_SOCKET_PATH`

**MediaSoup:** `NEXT_PUBLIC_USE_MEDIASOUP`, `NEXT_PUBLIC_MEDIASOUP_URL`, `NEXT_PUBLIC_MEDIASOUP_PATH`, `MEDIASOUP_PORT`, `MEDIASOUP_LISTEN_IP`, `MEDIASOUP_ANNOUNCED_IP`, `MEDIASOUP_RTC_MIN_PORT`, `MEDIASOUP_RTC_MAX_PORT`, `MEDIASOUP_NUM_WORKERS`, `MEDIASOUP_LOG_LEVEL`, `MEDIASOUP_CORS_ORIGINS`, `MEDIASOUP_SERVER_SECRET`, `NEXT_PUBLIC_STUN_URL`, `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_CREDENTIAL`, `FFMPEG_PATH`, `RECORDING_OUTPUT_DIR`

**PeerJS (legacy):** `PEER_PORT`, `NEXT_PUBLIC_PEER_HOST`, `NEXT_PUBLIC_PEER_PORT`, `NEXT_PUBLIC_PEER_PATH`

---

## Полезное при разработке

- После изменения схемы коллекций: `pnpm generate:types`
- После добавления кастомных компонентов в админку Payload: `pnpm generate:importmap`
- Проверка типов: `pnpm exec tsc --noEmit`
- Миграции: `pnpm migrate:create`, `pnpm migrate`, `pnpm migrate:status`
- При работе через Local API с `user` всегда указывать `overrideAccess: false`
- В хуках передавать `req` в вложенные операции, иначе они уйдут в отдельную транзакцию
