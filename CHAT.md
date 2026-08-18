# Чат-сервер (Socket.IO)

Документация по реалтайм-чату консультаций: страница `/lk/chat?appointment={id}`.

## 1. Как запускается

Чат работает на **отдельном Socket.IO-сервере**, НЕ внутри Next.js:

```bash
pnpm socket
# = cross-env NODE_OPTIONS="--no-deprecation --import=tsx/esm" node src/server.ts
```

Причина разделения — конфликт `AsyncLocalStorage` в Next.js 15/16 с socket.io внутри одного процесса. Поэтому:

- **Next.js** — порт `3000` (основное приложение).
- **Socket.IO** — порт `3001` (отдельный `http.createServer`), задаётся через `SOCKET_PORT`.

В проде оба обычно проксируются через один домен (nginx), клиент ходит по общему пути `/socket.io`.

### Переменные окружения

| Переменная | Где | Назначение | Дефолт |
|---|---|---|---|
| `SOCKET_PORT` | сервер | Порт Socket.IO | `3001` |
| `SOCKET_PATH` | сервер | Путь socket.io на сервере | *(undefined → `/socket.io`)* |
| `SERVER_URL` | сервер | Origin Next.js для CORS | `http://localhost:3000` |
| `SOCKET_ALLOWED_ORIGINS` | сервер | Доп. origins для CORS (через запятую) | `[]` |
| `PAYLOAD_SECRET` | сервер | Секрет для проверки JWT (через `getPayloadJwtSecret`) | — |
| `NEXT_PUBLIC_SOCKET_URL` | клиент | URL сокет-сервера | `http://localhost:3001` |
| `NEXT_PUBLIC_SOCKET_PATH` | клиент | Путь socket.io на клиенте | `/socket.io` |

> Внимание: на сервере путь берётся из `SOCKET_PATH` (по умолчанию `undefined`), а клиент по умолчанию шлёт `/socket.io`. Значения путей на сервере и клиенте должны совпадать — либо оба дефолтные, либо оба заданы одинаково.

## 2. Архитектура

```
Браузер (socket-provider.tsx)
        │  cookie: payload-token / doctors-token
        ▼
Socket.IO server (src/server.ts)
        │  io.use(authMiddleware)  ← проверка JWT из cookie
        ▼
initializeSocketServer (src/lib/socket/server.ts)
        │  регистрирует хэндлеры на события
        ▼
handlers/*  →  Payload CMS (overrideAccess: true)  →  БД
```

### Аутентификация (`middleware/authMiddleware.ts`)

1. Из хендшейка берутся cookie `payload-token` (пациент) и `doctors-token` (врач).
2. Каждый токен проверяется `verifyToken` через `jwt.verify` с производным секретом Payload.
3. Если валиден хотя бы один — в `socket.data` пишется `{ senderType, senderId, userId, doctorId }`.
4. Если оба невалидны — соединение отклоняется (`Authentication required`).

### Проверка доступа (`utils/verifyAppointmentAccess.ts`)

Перед КАЖДЫМ действием над консультацией грузится `appointment` и сверяется, что текущий `userId`/`doctorId` действительно её участник. Возвращает `accessType` (`user`/`doctor`) — на него опираются все хэндлеры.

### Комнаты

Одна консультация = одна комната `appointment:{id}`. Клиент шлёт `join-room`, сервер проверяет доступ и подключает сокет. Все события (`new-message`, `messages-read`, `consultation-started`, ...) рассылаются в рамках комнаты через `io.to(room).emit(...)`.

### События

| Событие (client → server) | Хэндлер | Кто может |
|---|---|---|
| `join-room` / `leave-room` | joinRoom / leaveRoom | участник |
| `send-message` | sendMessage | участник (rate-limited) |
| `mark-read` | markRead | участник |
| `typing` / `stop-typing` | typing / stopTyping | участник |
| `call-initiate` / `-answer` / `-reject` / `-end` | callHandler | участник |
| `consultation-start` / `-end` | consultation | **только врач** |
| `chat-block` / `chat-unblock` | consultation | **только врач**, статус `completed` |
| `change-connection-type` | consultation | **только пациент** |

## 3. Что сделано хорошо

- JWT реально **проверяется по подписи** (`jwt.verify`), а не просто декодируется. В комментарии указано, что раньше был `jwt.decode` без проверки — это исправлено.
- Доступ к консультации проверяется на сервере на каждом действии, а не только при входе.
- `preferredSenderType` перепроверяется против фактических прав (нельзя выдать себя за другого участника).
- Есть rate limiting на отправку сообщений и валидация/усечение текста (5000 симв.).
- Все операции с Payload идут `overrideAccess: true` осознанно — доступ уже проверен вручную выше.

## 4. Потенциальные дыры и слабые места (только чат)

> Отсортировано по важности. Это наблюдения для обсуждения — код в этом коммите не менялся, кроме удаления анимации в баннере.

### 4.1. Rate limit по `socket.id`, а не по пользователю — HIGH
`isRateLimited(authSocket.id)` считает лимит на **сокет**. Один клиент может открыть много сокетов (несколько вкладок / переподключений) и умножить лимит `10 msg/sec` на число соединений. Лучше ключевать по `senderType:senderId`.

### 4.2. Блокировка чата (`chatBlocked`) не мешает отправке сообщений — HIGH
`chat-block` ставит флаг `chatBlocked: true`, но `sendMessageHandler` **не проверяет** этот флаг. То есть «заблокированный» пациент технически всё ещё может слать `send-message` напрямую через сокет — блокировка живёт только в UI. Нужно в `sendMessageHandler` отклонять сообщения, если `appointment.chatBlocked === true` (для пациента).

### 4.3. `getCookieValue` через нестрогий RegExp — MEDIUM
`new RegExp(`${name}=([^;]+)`)` матчит подстроку: cookie `xpayload-token=` тоже совпадёт с `payload-token`, а имя не экранируется. Достаточно маловероятно, но лучше матчить по границе (`(?:^|;\s*)name=`) и брать точное имя.

### 4.4. Раскрытие данных в логах — MEDIUM
В `authMiddleware` в консоль пишутся сырые cookie и куски JWT (`[v0] Raw cookies string`, `userToken extracted: ...`). В проде это утечка чувствительных данных в логи. Эти `console.log` стоит убрать или спрятать за `NODE_ENV !== 'production'`.

### 4.5. Нет ограничения на объём/тип вложения на сервере — MEDIUM
`send-message` принимает `attachmentId` и лишь проверяет, что это положительное число, затем берёт media по id. Не проверяется, что вложение принадлежит этой консультации/отправителю — при знании чужого media id его можно прикрепить в свой чат (утечка чужого файла в комнату). Стоит валидировать владельца media.

### 4.6. Системные сообщения через `payload.create as any` — LOW
`consultation-start/-end/change-connection-type` создают системные сообщения с приведением `as any`, обходя типизацию (у сообщения нет обязательного `sender`). Работает, но хрупко — при изменении схемы `messages` сломается молча. Лучше типобезопасный путь.

### 4.7. In-memory состояние — LOW (архитектурное)
Rate limit и адаптер Socket.IO — **in-memory, один процесс** (в `server.ts` прямо сказано `single process mode`). При горизонтальном масштабировании (несколько инстансов) комнаты и лимиты не будут общими — понадобится Redis-адаптер. Сейчас это ок, но заложите на будущее.

### 4.8. CORS fallback на первый origin — LOW
В OPTIONS-ответе при неизвестном origin отдаётся `ALL_ORIGINS[0]` вместо отказа. Не критично (браузер всё равно сверит), но чище вернуть отсутствие заголовка/403.

## 5. Резюме
Ядро сделано грамотно: подпись JWT проверяется, доступ к консультации валидируется на каждом действии, роли (врач/пациент) разграничены. Главное, что стоит закрыть в первую очередь — **4.1 (rate limit по сокету)** и **4.2 (blocked-чат не блокирует сокет)**, затем прибрать логи с токенами (4.4) и проверить владельца вложений (4.5).
