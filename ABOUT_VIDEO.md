# Архитектура видеозвонков в проекте Telemed

> **ИДЕТ МИГРАЦИЯ:** Планируется переход с PeerJS на MediaSoup для серверной записи.  
> См. [MediaSoupMigration.md](./MediaSoupMigration.md) для деталей.

## Оглавление

- [Высокоуровневая схема](#высокоуровневая-схема)
- [Технологии](#технологии)
- [Ключевые компоненты](#ключевые-компоненты)
- [Серверная часть](#серверная-часть)
- [Состояния звонка](#состояния-звонка)
- [Пошаговый процесс звонка](#пошаговый-процесс-звонка)
- [Конфигурация](#конфигурация)
- [Почему это работает](#почему-это-работает)

---

## Высокоуровневая схема

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              КЛИЕНТ (Browser)                                │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────────┐│
│  │  /lk/chat       │     │  /lk-med/chat   │     │  VideoCallProvider      ││
│  │  (Пациент)      │     │  (Врач)         │     │  VideoCallOverlay       ││
│  └────────┬────────┘     └────────┬────────┘     └──────────┬──────────────┘│
│           │                       │                         │               │
│           ▼                       ▼                         ▼               │
│  ┌──────────────────────────────────────────────────────────────────────────│
│  │                       SocketProvider                                      │
│  │  (WebSocket соединение для сигналинга звонков)                           │
│  └───────────────────────────────┬──────────────────────────────────────────│
│                                  │                                          │
│                                  ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────────│
│  │                      PeerJS Client (WebRTC)                               │
│  │  (P2P видео/аудио стриминг)                                              │
│  └───────────────────────────────┬──────────────────────────────────────────│
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────────┐  ┌───────────────────────┐  ┌─────────────────────────┐
│  Socket.IO Server │  │    PeerJS Server      │  │   TURN/STUN Servers     │
│  (src/server.ts)  │  │ (src/peer-server.ts)  │  │  (nice-sites.online)    │
│  Порт: 3001       │  │  Порт: 3002           │  │  Порт: 3478/5349        │
└───────────────────┘  └───────────────────────┘  └─────────────────────────┘
```

---

## Технологии

| Технология | Назначение |
|------------|------------|
| **Socket.IO** | WebSocket библиотека для real-time сигналинга |
| **PeerJS** | Обертка над WebRTC для упрощения P2P соединений |
| **WebRTC** | Стандарт для peer-to-peer аудио/видео в браузере |
| **STUN/TURN** | Серверы для NAT traversal и relay |
| **Zustand** | State management для состояния звонка |

---

## Ключевые компоненты

### 1. Страницы чата

| Файл | Описание |
|------|----------|
| `src/app/(frontend)/lk/chat/page.tsx` | Страница чата для **пациентов** (Users). Загружает `ChatPage` с `currentSenderType="user"` |
| `src/app/(frontend)/lk-med/chat/page.tsx` | Страница чата для **врачей** (Doctors). Загружает `DoctorChatWrapper` |

### 2. Провайдеры (Context)

| Компонент | Файл | Роль |
|-----------|------|------|
| `SocketProvider` | `src/components/socket-provider.tsx` | Управляет WebSocket соединением для сигналинга (вызов, ответ, отклонение, завершение) |
| `VideoCallProvider` | `src/components/video-call/video-call-provider.tsx` | Главный провайдер видеозвонков. Управляет PeerJS, медиа-стримами, состоянием звонка |

### 3. UI Компоненты видеозвонков

| Компонент | Файл | Роль |
|-----------|------|------|
| `VideoCallOverlay` | `src/components/video-call/video-call-overlay.tsx` | Глобальный оверлей, который рендерит нужное view в зависимости от статуса звонка |
| `IncomingCallView` | `src/components/video-call/views/incoming-call-view.tsx` | UI для входящего звонка (кнопки "Принять"/"Отклонить") |
| `CallingView` | `src/components/video-call/views/calling-view.tsx` | UI исходящего звонка (ожидание ответа) |
| `ConnectingView` | `src/components/video-call/views/connecting-view.tsx` | UI подключения |
| `ConnectedView` | `src/components/video-call/views/connected-view.tsx` | Главный UI активного звонка с видео |
| `MinimizedView` | `src/components/video-call/views/minimized-view.tsx` | Свернутый вид (PiP) |
| `LocalVideo` | `src/components/video-call/components/local-video.tsx` | Компонент локального видео (камера пользователя) |
| `RemoteVideo` | `src/components/video-call/components/remote-video.tsx` | Компонент удаленного видео (собеседник) |
| `CallControls` | `src/components/video-call/components/call-controls.tsx` | Кн��������пки управления (вкл/выкл камеру, микрофон, завершить) |
| `CallTimer` | `src/components/video-call/components/call-timer.tsx` | Таймер консультации |
| `ConnectionQuality` | `src/components/video-call/components/connection-quality.tsx` | Индикатор качества соединения |

### 4. Хуки

| Хук | Файл | Роль |
|-----|------|------|
| `usePeerConnection` | `src/components/video-call/hooks/use-peer-connection.ts` | Управление PeerJS соединением |
| `useMediaStream` | `src/components/video-call/hooks/use-media-stream.ts` | Управление медиа-стримом (камера/микрофон) |
| `useCallTimer` | `src/components/video-call/hooks/use-call-timer.ts` | Таймер консультации |
| `useConnectionQuality` | `src/components/video-call/hooks/use-connection-quality.ts` | Мониторинг качества соединения |
| `useTurnTest` | `src/components/video-call/hooks/use-turn-test.ts` | Тестирование TURN сервера |

### 5. Zustand Stores

| Store | Файл | Роль |
|-------|------|------|
| `useCallStore` | `src/stores/call-store.ts` | Глобальное состояние звонка (status, streams, peerId и т.д.) |
| `useUserStore` | `src/stores/user-store.ts` | Данные текущего пациента |
| `useDoctorStore` | `src/stores/doctor-store.ts` | Данные текущего врача |

---

## Серверная часть

### Серверы

| Сервер | Файл | Порт | Роль |
|--------|------|------|------|
| **Socket.IO Server** | `src/lib/socket/server.ts` | 3001 | Сигналинг звонков (call-initiate, call-answer, call-reject, call-end) |
| **PeerJS Server** | `src/peer-server.ts` | 3002 | WebRTC signaling для P2P соединения |

### Socket Handlers (сигналинг)

Файл: `src/lib/socket/handlers/callHandler.ts`

| Handler | Событие | Описание |
|---------|---------|----------|
| `createCallHandler` | `call-initiate` | Инициирует звонок, получает `targetId` из БД, отправляет `incoming-call` конкретному получателю |
| `createCallAnswerHandler` | `call-answer` | Принимает звонок, отправляет `call-answered` звонящему |
| `createCallRejectHandler` | `call-reject` | Отклоняет звонок, отправляет `call-rejected` звонящему |
| `createCallEndHandler` | `call-end` | Завершает звонок, отправляет `call-ended` обоим участникам |
| `checkPendingCallsForSocket` | (при подключении) | Проверяет активные звонки для пользователя при подключении/переподключении |

### Active Calls Store

Файл: `src/lib/socket/stores/activeCallsStore.ts`

Хранит активные звонки в памяти сервера для обработки случаев, когда получатель подключается позже звонящего.

```typescript
interface ActiveCall {
  appointmentId: number       // ID записи
  callerPeerId: string        // PeerJS ID звонящего
  callerName: string          // Имя звонящего
  callerType: 'user' | 'doctor'
  callerId: number            // ID звонящего в БД
  targetType: 'user' | 'doctor'
  targetId: number | null     // ID получателя (из БД appointment)
  createdAt: number           // Timestamp создания
}
```

| Функция | Описание |
|---------|----------|
| `addActiveCall(call)` | Добавляет активный звонок |
| `removeActiveCall(appointmentId)` | Удаляет звонок при завершении/отклонении |
| `getActiveCallsForTarget(type, id)` | Получает звонки для конкретного пользователя |
| `hasActiveCall(appointmentId)` | Проверяет, есть ли активный звонок |

### Структура Socket событий

```typescript
// Исходящие от клиента
'call-initiate'   // { recipientId, recipientType, callerInfo }
'call-answer'     // { callerId, callerType, peerId }
'call-reject'     // { callerId, callerType, reason }
'call-end'        // { recipientId, recipientType }

// Входящие к клиенту
'incoming-call'   // Входящий звонок
'call-answered'   // Звонок принят
'call-rejected'   // Звонок отклонен
'call-ended'      // Звонок завершен
```

---

## Состояния звонка

```typescript
type CallStatus =
  | 'idle'        // Нет активного звонка
  | 'incoming'    // Входящий звонок (показывается IncomingCallView)
  | 'calling'     // Исходящий звонок (ждем ответа)
  | 'connecting'  // Устанавливается P2P соединение
  | 'connected'   // Активный звонок
  | 'reconnecting'// Переподключение
  | 'ended'       // Звонок завершен
  | 'error'       // Ошибка
```

### Диаграмма переходов состояний

```
                    startCall()
        idle ─────────────────────► calling
          │                            │
          │                            │ call-answered
          │ incoming-call              ▼
          ▼                        connecting
      incoming                         │
          │                            │ peer connected
          │ answerCall()               ▼
          └───────────────────────► connected
                                       │
                                       │ endCall() / call-ended
                                       ▼
                                     ended
                                       │
                                       │ timeout
                                       ▼
                                     idle
```

---

## Пошаговый процесс звонка

### Сценарий: Врач звонит пациенту

```
Врач (Doctor)                          Сервер                           Пациент (User)
     │                                   │                                    │
     │ 1. startCall()                    │                                    │
     │ ─────────────────────────────────>│                                    │
     │    emit('call-initiate')          │                                    │
     │                                   │                                    │
     │                                   │ 2. Получает appointment из БД      │
     │                                   │    Извлекает targetId (userId)     │
     │                                   │    Сохраняет в activeCallsStore    │
     │                                   │                                    │
     │                                   │ 3. Находит сокеты пациента         │
     │                                   │    по targetId (НЕ всех users!)    │
     │                                   │ ─────────────────────────────────> │
     │                                   │    emit('incoming-call')           │
     │                                   │                                    │
     │                                   │                    4. Показывает   │
     │                                   │                    IncomingCallView│
     │                                   │                                    │
     │                                   │ <───────────────────────────────── │
     │                                   │    5. answerCall()                 ���
     │                                   │       emit('call-answer')          │
     │                                   │                                    │
     │ <─────────────────────────────────│                                    │
     │ 6. Получает 'call-answered'       │                                    │
     │    setRemoteAnswered(true)        │                                    │
     │                                   │                                    │
     │ 7. peer.call(remotePeerId, stream)│                                    │
     │ ═══════════════════════════════════════════════════════════════════════│
     │                      PeerJS (WebRTC P2P соединение)                    │
     │ ═══════════════════════════════════════════════════════════════════════│
     │                                   │                                    │
     │ 8. on('stream') - получили        │           on('call') - получили    │
     │    удаленный видеопоток           │              входящий peer call    │
     │                                   │           incomingCall.answer()    │
     │                                   │                                    │
     │ <═══════════════════ WebRTC Media Stream ══════════════════════════════>│
     │                                   │                                    │
```

### Детальное описание шагов

1. **Врач нажимает кнопку звонка**
   - Вызывается `startCall()` из `useVideoCall()`
   - Запрашивается доступ к камере/микрофону
   - Создается PeerJS инстанс
   - Отправляется событие `call-initiate` на Socket сервер

2. **Сервер получает appointment из БД**
   - `callHandler` получает событие с `appointmentId`
   - Запрашивает appointment из Payload CMS
   - Извлекает `targetId` (userId если звонит doctor, doctorId если звонит user)
   - Сохраняет звонок в `activeCallsStore` с `targetId`

3. **Сервер маршрутизирует звонок конкретному пользователю**
   - Находит сокеты только с `senderId === targetId` и `senderType === targetType`
   - Отправляет `incoming-call` только этому конкретному пользователю
   - Другие пациенты НЕ получают этот звонок

4. **Пациент видит входящий звонок**
   - `SocketProvider` получает `incoming-call`
   - `useCallStore` переходит в состояние `incoming`
   - `VideoCallOverlay` показывает `IncomingCallView`

5. **Пациент принимает звонок**
   - Нажимает кнопку "Принять"
   - Вызывается `answerCall()` из `useVideoCall()`
   - Запрашивается доступ к камере/микрофону
   - Создается PeerJS инстанс
   - Отправляется `call-answer` с `peerId` на сервер

6. **Врач получает подтверждение**
   - Получает событие `call-answered` с `peerId` пациента
   - `setRemoteAnswered(true)` и `setRemotePeerId(peerId)`

7. **Устанавливается P2P соединение**
   - Врач вызывает `peer.call(remotePeerId, localStream)`
   - PeerJS использует ICE серверы для NAT traversal
   - Устанавливается прямое соединение между браузерами

8. **Обмен медиа-потоками**
   - Пациент получает входящий `peer.on('call')` и отвечает `call.answer(localStream)`
   - Оба получают `call.on('stream')` с удаленным потоком
   - Состояние переходит в `connected`
   - `ConnectedView` отображает оба видео

### Сценарий: Пациент подключается после начала звонка

Этот сценарий важен когда:
- Пациент перезагрузил страницу во время входящего звонка
- Пациент подключился к системе позже, чем врач начал звонить
- Произошел временный разрыв WebSocket соединения

```
Врач (Doctor)                          Сервер                           Пациент (User)
     │                                   │                                    │
     │ 1. startCall()                    │                                    │
     │ ─────────────────────────────────>│                                    │
     │    emit('call-initiate')          │                                    │
     │                                   │                                    │
     │                                   │ 2. Сохраняет в activeCallsStore    │
     │                                   │    { appointmentId, targetId, ... }│
     │                                   │                                    │
     │                                   │ 3. Пациент НЕ подключен!           │
     │                                   │    Звонок сохранен, ждем...        │
     │                                   │                                    │
     │                                   │                    4. Пациент      │
     │                                   │ <───────────────────────────────── │
     │                                   │    подключается (socket connect)   │
     │                                   │                                    │
     │                                   │ 5. checkPendingCallsForSocket()    │
     │                                   │    Ищет звонки где:                │
     │                                   │    - targetType === 'user'         │
     │                                   │    - targetId === пациент.id       │
     │                                   │                                    │
     │                                   │ 6. Нашли! Отправляем звонок        │
     │                                   │ ─────────────────────────────────> │
     │                                   │    emit('incoming-call')           │
     │                                   │                                    │
     │                                   │                    7. Пациент      │
     │                                   │                    видит звонок!   │
     │                                   │                                    │
```

**Ключевые моменты:**
- `targetId` получается из БД (appointment), а не из подключенных сокетов
- Звонок хранится в `activeCallsStore` пока не будет принят/отклонен/завершен
- При подключении нового сокета `checkPendingCallsForSocket` проверяет pending calls
- Фильтрация по `targetId` гарантирует, что звонок получит только нужный пользователь

---

## Конфигурация

Файл: `src/lib/video-call/config.ts`

### ICE серверы для NAT traversal

```typescript
export const ICE_SERVERS = [
  // STUN сервер (бесплатный, для простых случаев)
  { urls: 'stun:nice-sites.online:3478' },
  
  // TURN серверы (для сложных сетей, за NAT/firewall)
  { 
    urls: 'turn:nice-sites.online:3478',
    username: '...',
    credential: '...'
  },
  { 
    urls: 'turn:nice-sites.online:3478?transport=tcp',
    username: '...',
    credential: '...'
  },
  
  // TURNS (TURN over TLS) для корпоративных сетей
  { 
    urls: 'turns:nice-sites.online:5349',
    username: '...',
    credential: '...'
  },
]
```

### Таймауты

```typescript
export const CALL_TIMEOUTS = {
  CALL_TIMEOUT: 30000,        // 30 сек ожидания ответа
  RECONNECT_INTERVAL: 2000,   // 2 сек между попытками переподключения
  MAX_RECONNECT_ATTEMPTS: 3,  // Максимум 3 попытки
}
```

### Настройки медиа

```typescript
export const MEDIA_CONSTRAINTS = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: 'user'
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
}
```

---

## Почему это работает

### 1. Разделение ответственности

- **Socket.IO** используется **только** для сигналинга (передача метаданных о звонке)
- **PeerJS/WebRTC** используется для передачи медиа-данных
- Это позволяет серверу быть легковесным - он не обрабатывает видео

### 2. P2P архитектура

- Медиа-потоки идут **напрямую между браузерами**
- Сервер не участвует в передаче видео/аудио
- Минимальная задержка, максимальное качество

### 3. NAT Traversal

- **STUN** сервер помогает узнать публичный IP
- **TURN** сервер работает как relay для сложных сетей
- Поддержка TCP и TLS для корпоративных firewall

### 4. Zustand для состояния

- Глобальный store позволяет любому компоненту реагировать на звонок
- `VideoCallOverlay` может показываться поверх любой страницы
- Состояние сохраняется при навигации

---

## Структура файлов

```
src/
├── app/(frontend)/
│   ├── lk/
│   │   └── chat/
│   │       └── page.tsx              # Страница чата пациента
│   └── lk-med/
│       └── chat/
│           └── page.tsx              # Страница чата врача
│
├── components/
│   ├── socket-provider.tsx           # WebSocket провайдер
│   ├── chat/
│   │   └── chat-page.tsx             # Основной компонент чата
│   └── video-call/
│       ├── video-call-provider.tsx   # Главный провайдер
│       ├── video-call-overlay.tsx    # Оверлей звонка
│       ├── components/
│       │   ├── local-video.tsx       # Локальное видео
│       │   ├── remote-video.tsx      # Удаленное видео
│       │   ├── call-controls.tsx     # Кнопки управления
│       │   ├── call-timer.tsx        # Таймер
│       │   └── connection-quality.tsx # Качество связи
│       ├── views/
│       │   ├── incoming-call-view.tsx # Входящий звонок
│       │   ├── calling-view.tsx       # Исходящий звонок
│       │   ├── connecting-view.tsx    # Подключение
│       │   ├── connected-view.tsx     # Активный звонок
│       │   └── minimized-view.tsx     # Свернутый вид
│       └── hooks/
│           ├── use-peer-connection.ts # PeerJS хук
│           ├── use-media-stream.ts    # Медиа хук
│           ├── use-call-timer.ts      # Таймер хук
│           └── use-connection-quality.ts # Качество хук
│
├── lib/
│   ├── socket/
│   │   ├── server.ts                 # Socket.IO сервер
│   │   ├── handlers/
│   │   │   └── callHandler.ts        # Обработчики звонков
│   │   └── stores/
│   │       └── activeCallsStore.ts   # Хранилище активных звонков
│   └── video-call/
│       ├── config.ts                 # Конфигурация
│       └── types.ts                  # TypeScript типы
│
├── stores/
│   ├── call-store.ts                 # Zustand store звонка
│   ├── user-store.ts                 # Store пациента
│   └── doctor-store.ts               # Store врача
│
├── server.ts                         # Главный сервер
└── peer-server.ts                    # PeerJS сервер
```

---

## Диаграмма компонентов

```
/lk/chat ─────────────────────────────┐
                                      │
                                      ▼
                              ┌───────────────┐
                              │   ChatPage    │
                              └───────┬───────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
      SocketProvider          ChatWindow              VideoCallProvider
              │                                              │
              ▼                                              ▼
         useSocket()                                   useVideoCall()
              │                                              │
              │                                              ▼
              │                                     VideoCallOverlay
              │                                              │
              ▼                                              ▼
    Socket.IO Server  ◄─────────────────────────►   PeerJS Client
    (сигналинг)                                    (P2P видео)
```

---

## Система записи звонков (Chunks)

### Архитектура

Запись видеозвонков использует **периодическую отправку chunks** на сервер для надежности. Если врач случайно закроет вкладку или потеряет соединение, потеряются только последние 30 секунд записи.

### Picture-in-Picture (PiP) запись

Записывается **композитный видеопоток**:
- **Основное видео (1280x720):** камера врача (full-screen)
- **Маленькое окошко (240x180):** камера пациента в правом нижнем углу
- **Аудио:** микрофоны обоих участников смешиваются в один трек

Реализация использует `<canvas>` для композитинга:

```
┌──────────────────────────────────────┐
│                                      │
│          ВРАЧ (основной)             │
│                                      │
│                       ┌──────────┐   │
│                       │ ПАЦИЕНТ  │   │
│                       │  (PiP)   │   │
│                       └──────────┘   │
└──────────────────────────────────────┘
         1280x720 canvas
```

**Константы:**
- `CANVAS_WIDTH = 1280`
- `CANVAS_HEIGHT = 720`
- `PIP_WIDTH = 240`
- `PIP_HEIGHT = 180`
- `PIP_MARGIN = 20` (отступ от края)

```
┌────────────────────────────────────────────────────���───���────────────────────┐
│                              КЛИЕНТ (Врач)                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        useCallRecording Hook                            ││
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐ ││
│  │  │ MediaRecorder│───►│ Chunks Buffer│───►│ Периодическая отправка     │ ││
│  │  │ (WebM/VP8)  │    │ (в памяти)  │    │ каждые 30 сек              │ ││
│  │  └─────────────┘    └─────────────┘    └──────────────┬──────────────┘ ││
│  └───────────────────────────────────────────────────────┼─────────────────┘│
└──────────────────────────────────────────────────────────┼──────────────────┘
                                                           │
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              СЕРВЕР                                          │
│  ┌─────────────────────┐         ┌─────────────────────────────────────────┐│
│  │ /api/recording-chunks│         │ /api/recording-chunks/finalize         ││
│  │ POST - сохранить chunk│        │ POST - склеить все chunks              ││
│  │ в /tmp/recording-   │         │ → загрузить в Media                    ││
│  │ chunks/{sessionId}/ │         │ → создать CallRecording                ││
│  └─────────────────────┘         └─────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Файлы системы записи

| Файл | Описание |
|------|----------|
| `src/components/video-call/hooks/use-call-recording.ts` | Хук записи с периодической отправкой chunks |
| `src/app/api/recording-chunks/route.ts` | API для приема chunks |
| `src/app/api/recording-chunks/finalize/route.ts` | API для склейки chunks и создания записи |
| `src/lib/api/call-recordings.ts` | Клиентский API для записей |

### Процесс записи

1. **Старт записи** - при подключении звонка (`status === 'connected'`)
   - Создается `MediaRecorder` с кодеком `video/webm;codecs=vp8,opus`
   - Генерируется уникальный `sessionId` для этой записи
   - Chunks накапливаются в буфере

2. **Периодическая отправка** - каждые 30 секунд (`CHUNK_INTERVAL_MS = 30000`)
   - Буфер chunks конвертируется в Blob
   - Отправляется POST на `/api/recording-chunks` с `sessionId` и `chunkIndex`
   - Сервер сохраняет chunk в `/tmp/recording-chunks/{sessionId}/chunk-{index}.webm`

3. **Завершение записи** - при завершении звонка
   - Последние chunks отправляются на сервер
   - Вызывается POST `/api/recording-chunks/finalize`
   - Сервер склеивает все chunks в один файл
   - Загружает в коллекцию `Media`
   - Создает запись в коллекции `CallRecordings`
   - **Очищает временные файлы** - удаляет chunks из `/tmp/recording-chunks/` через `cleanupSession()`

### Параметры

```typescript
const CHUNK_INTERVAL_MS = 30000  // 30 секунд между отправками
const RECORDER_TIMESLICE = 1000  // MediaRecorder создает chunk каждую секунду
```

### Логирование

Все логи записи имеют префикс `[Recording]`:

| Лог | Описание |
|-----|----------|
| `[Recording] Starting...` | Начало записи |
| `[Recording] Uploading chunk` | Отправка chunk на сервер |
| `[Recording] Chunk uploaded successfully` | Успешная загрузка chunk |
| `[Recording] Finalizing recording` | Начало склейки |
| `[Recording] Recording finalized` | Успешное создание записи |

### Нагрузка на сервер

- **Размер chunk**: ~10-15 MB (30 секунд видео 720p)
- **Частота**: 1 запрос каждые 30 секунд на звонок
- **10 одновременных звонков**: ~3-5 MB/сек

### Fallback (Клиентское сохранение)

Система имеет **двухуровневую архитектуру сохранения**:

1. **Основной путь (Server-side Chunks):**
   - Chunks отправляются каждые 30 секунд на `/api/recording-chunks`
   - При завершении вызывается `/api/recording-chunks/finalize`
   - Сервер склеивает chunks и создает запись

2. **Fallback (Client-side):**
   - Если серверная склейка не удалась, система автоматически загружает весь blob с клиента
   - Видео отправляется целиком на `/api/media`, затем создается `CallRecording`

**Нет конфликта** между этими двумя методами - они работают последовательно:

```typescript
// В uploadRecording():
if (chunkUploadStateRef.current) {
  const success = await finalizeRecording() // Сначала пробуем server-side
  if (success) return true
}
// Если server-side не сработал - client-side fallback
const blob = blobOverride || recordingBlob
// ... загрузка всего blob
```

### Аутентификация API записи

API `/api/recording-chunks` и `/api/recording-chunks/finalize` используют аутентификацию по токену врача:

1. Токен `doctors-token` берется из cookies
2. Верифицируется с использованием `payload.secret` (тот же secret, которым токен был подписан при логине)
3. Проверяется что `collection === 'doctors'`
4. Проверяется что `doctorId` в запросе совпадает с ID из токена

### Завершение звонка любой стороной

**Проблема (исправлена):** Ранее запись сохранялась только если звонок завершал врач. Если пациент завершал звонок, запись терялась.

**Причина:** Когда пациент завершал звонок:
1. Событие `call-ended` приходило врачу через WebSocket
2. Callback `handleCallEnded()` вызывался **синхронно** (без await)
3. Сразу после вызова callbacks выполнялся `callStoreRef.current.endCall()` - очистка store
4. `handleCallEnded()` не успевал завершить сохранение записи, т.к. store уже был очищен

**Решение:**
1. Callback `onRemoteCallEnded` теперь поддерживает **async функции**
2. `socket-provider.tsx` **ожидает (await)** завершения всех async callbacks перед очисткой store
3. Используются `ref` вместо `state` для проверки статуса (`statusRef`, `isRecordingRef`) - избегаем stale closures
4. Pending chunks **не очищаются** в `stopRecording` - они сохраняются для финальной отправки

**Файлы изменений:**
- `src/components/socket-provider.tsx` - async callbacks + await
- `src/components/video-call/video-call-provider.tsx` - async callback + refs
- `src/components/video-call/hooks/use-call-recording.ts` - isRecordingRef + сохранение pending chunks

### Закрытие страницы во время сохранения

**Важно:** Если врач закроет страницу во время показа "Сохранение видео, подождите... Не закрывайте страницу":

1. **Финализация прервется** - запрос на `/api/recording-chunks/finalize` не завершится
2. **Chunks уже на сервере** - все chunks (каждые 30 сек) уже сохранены в `/tmp/recording-chunks/{sessionId}/`
3. **Запись НЕ создастся** - `CallRecording` не появится в БД, т.к. finalize не вызвался
4. **Chunks останутся** - временные файлы останутся на сервере как "мусор"

**Потери данных:**
- Последние ~30 секунд (pending chunks в браузере)
- Остальные chunks сохранены, но не собраны в видео

**TODO:** Можно добавить cron job для восстановления "осиротевших" chunks.

---

## Troubleshooting

### Звонок не устанавливается

1. Проверьте, что PeerJS сервер запущен на порту 3002
2. Проверьте, что STUN/TURN серверы доступны
3. Проверьте права доступа к камере/микрофону

### WebSocket connection to 'wss://localhost:...' failed (в dev режиме)

**Проблема:** PeerJS пытается подключиться к `wss://localhost:3002` вместо `ws://localhost:3002`.

**Причина:** Локальный PeerJS сервер работает без SSL, но клиент использовал `secure: true` для всех подключений.

**Решение (исправлено в коде):** В `video-call-provider.tsx` параметр `secure` теперь определяется динамически:

```typescript
// Use secure connection only for non-localhost hosts
const isSecure = peerHost !== 'localhost' && peerHost !== '127.0.0.1'
```

- Для `localhost` / `127.0.0.1` -> `secure: false` (использует `ws://`)
- Для production хостов (например `smartcardio.ru`) -> `secure: true` (использует `wss://`)

### Нет видео/аудио

1. Проверьте `mediaStream` в DevTools
2. Убедитесь, что браузер дал разрешения
3. Проверьте `ICE connection state` в WebRTC internals

### Звонок обрывается

1. Проверьте качест��о соединения
2. Возможно, TURN сервер недоступен
3. Проверьте логи в `useConnectionQuality`

---

## Полезные ссылки

- [WebRTC Documentation](https://webrtc.org/)
- [PeerJS Documentation](https://peerjs.com/docs/)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
