# VIDEO_AND_AUDIO_PLAN.md

Полный план переноса системы звонков (видео / аудио / демонстрация экрана) из репозитория
**`SecondNiceee/replixo`** в **`SecondNiceee/telemed`** (Next.js 15 + Payload CMS 3).

Документ самодостаточный: в нём собраны все константы, события сигналинга, структура файлов и
пошаговый порядок работ, чтобы выполнить миграцию **не открывая репозиторий replixo**.

> Легенда:
> **[COPY]** — переносим файл почти как есть (правим только импорты/пути).
> **[ADAPT]** — переносим, но адаптируем под telemed (roomId, auth, config, recorder).
> **[REUSE]** — уже есть в telemed, переиспользуем без изменений или с минимальными правками.
> **[NEW]** — создаём новый файл в telemed.
> **[SKIP]** — из replixo НЕ переносим.

---

## 0. Цель и принципы

1. Заменить старую систему звонков telemed (PeerJS + смешанный MediaSoup + оверлей-звонок поверх
   чата) на **комнатную MediaSoup SFU** из replixo.
2. `roomId = appointment_<id>` — тот же формат, что уже использует `recorder.ts` и
   `mediasoup-server.ts` telemed (см. `roomId.replace('appointment_', '')`).
3. Переносим **только ядро связи**: видео, аудио, демонстрация экрана, комнаты, reconnect +
   ICE-restart, network guard (деградация видео ради голоса), устойчивый микрофон (mic-gate).
4. **НЕ переносим**: чат в комнате, whiteboard (tldraw), презентации/слайды, аннотации поверх
   демонстрации, Electron-overlay, DM-namespace, загрузку файлов в комнату, установщик Windows.
5. **Переиспользуем существующее в telemed**: `src/lib/mediasoup/config.ts`,
   `src/lib/mediasoup/worker-manager.ts`, `src/lib/mediasoup/recorder.ts`, коллекцию
   `call-recordings`, маршруты финализации записи, чат-сокет (`src/lib/socket/*`) как слой дозвона.
6. Медиа (SFU) полностью изолировано от сигналинга дозвона: **дозвон живёт в чат-сокете
   (`src/server.ts`), медиа — в mediasoup-сервере (`src/mediasoup-server.ts`)**. Ровно как в
   replixo, где дозвон был в namespace `/dm`, а медиа — в корневом namespace.

---

## 1. Инвентаризация исходников replixo

### 1.1 Серверная часть (`replixo/server/src/`)

| Файл | Строк | Действие | Назначение |
|------|-------|----------|------------|
| `config.ts` | 170 | **[ADAPT]** | Порт, CORS, ICE/TURN, worker settings, mediaCodecs (VP8+H264), webRtcTransportOptions. Часть значений заменим на telemed `config.ts`. |
| `Room.ts` | 518 | **[ADAPT]** | Класс комнаты: router, peers, транспорты по direction, produce/consume, ICE-restart, pause/resume producer/consumer, simulcast-слои, keyframe. |
| `Peer.ts` | 62 | **[COPY]** | Пир: transports/producers/consumers Map + `resetMedia()`. |
| `socket.ts` | 63 | **[ADAPT]** | Оркестратор Socket.IO: pingTimeout 30s/pingInterval 10s, регистрация хендлеров. Убираем chat/whiteboard/presentation/annotation/DM. |
| `socket/room-registry.ts` | 229 | **[ADAPT]** | In-memory реестр комнат, `peerSockets`, `peerClients`, grace-окна (45s/6s/10s), duplicate-kick, `getOrCreateRoom`, `evictPeer`, `cleanupRoomIfEmpty`. Убираем гидрацию whiteboard/presentation из БД. |
| `socket/media-handlers.ts` | 558 | **[ADAPT]** | `joinRoom`, `resetMediaState`, `createWebRtcTransport`, `connectTransport`, `restartIce`, `produce`, `consume`, `resumeConsumer`, `closeConsumer`, `pauseConsumer`, `setConsumerLayers`, `requestConsumerKeyFrame`, `closeProducer`, `pauseProducer`. Убираем поля чата/доски из ack `joinRoom`. Добавляем интеграцию записи. |
| `socket/lifecycle-handlers.ts` | 156 | **[COPY]** | `rejoinProbe`, `leaveRoom`, `disconnect` + выбор grace-окна. |
| `socket/helpers.ts` | 57 | **[COPY]** | `ack`/`err` (guard от отсутствующего callback), `createRateLimiter`, `SocketSession`, `HandlerContext`. |
| `index.ts` | 370 | **[SKIP]** (взять только идеи) | HTTP-сервер replixo: express, multer, статика, установщик. Нам нужен только: **beacon-эндпоинт `/rooms/:id/leave`** и создание mediasoup worker. Остальное игнорируем. |
| `logger.ts` | 55 | **[COPY]** (опц.) | Патч console → добавляет дату/время в логи. Полезно, но не обязательно. |
| `room-code.ts` | 7 | **[ADAPT]** | `canonicalRoomCode` под формат `appointment_<id>` (см. §4.9). |
| `db.ts`, `dm/*`, `socket/chat-handlers.ts`, `socket/whiteboard-handlers.ts`, `socket/presentation-handlers.ts`, `socket/annotation-handlers.ts`, `uploads.ts`, `upload-filename.ts`, `types.ts` (частично) | — | **[SKIP]** | Чат в БД, ЛС, доска, презентации, аннотации, вложения. Из `types.ts` берём только payload-типы медиа-событий. |

### 1.2 Клиентская часть (`replixo/hooks/`, `replixo/lib/`, `replixo/stores/`, `replixo/public/`)

| Файл | Строк | Действие | Назначение |
|------|-------|----------|------------|
| `hooks/use-mediasoup.ts` | 895 | **[ADAPT]** | Главный хук: reducer state, ~30 refs, `join`/`leave`, evidence-based `recoverConnection`, `assessSession`, rebuild с cooldown. Убираем chat/whiteboard из ack и sub-хуков. |
| `hooks/mediasoup/types.ts` | 363 | **[ADAPT]** | Клиентские типы + все константы: `SCREEN_QUALITY_PRESETS`, `CAMERA_ENCODINGS`, `VOICE_CODEC_OPTIONS`, `NETWORK_GUARD`, `SERVER_URL` (resolveServerUrl), `CLIENT_ID`, `getOrCreatePeerId`. Адаптируем `peerId` под роль (см. §5.1). |
| `hooks/mediasoup/use-transports.ts` | 694 | **[COPY]** | Send/recv транспорты, `consumeProducer`, `restartIceForTransport`, ICE-retry-ladder, подавление видео-консьюмеров. |
| `hooks/mediasoup/use-media-controls.ts` | 1247 | **[ADAPT]** | Микрофон/камера/демонстрация: `toggleMic`/`switchMic`/`toggleCam`/`toggleScreenShare`, `recoverMic`/`recoverCamera`/`recoverScreenShare`, permission/mic notice. Убираем Electron-capture и presentation-follow (или оставляем как no-op в браузере). |
| `hooks/mediasoup/use-network-guard.ts` | 1027 | **[COPY]** | Слабая сеть: сэмплинг uplink/downlink, деградация → сжатие слоёв → пауза видео, `noteUserWantsVideo`, флаги `videoDegraded/uplinkVideoSuppressed/downlinkVideoSuppressed`. |
| `hooks/mediasoup/producer-transport.ts` | 50 | **[COPY]** | `rememberProducerTransport` / `isProducerOnStaleTransport`. |
| `hooks/mediasoup/reducer.ts` | 154 | **[ADAPT]** | Reducer состояния комнаты. Убираем экшены чата/доски (`ADD_MESSAGE`, `SET_WHITEBOARD`, ...). |
| `hooks/mediasoup/register-socket-listeners.ts` | 156 | **[ADAPT]** | Подписка на серверные события (`peerJoined`, `peerLeft`, `newProducer`, `producerClosed`, `producerPaused`, `kicked`). Убираем chat/whiteboard-события. |
| `hooks/mediasoup/use-media-controls.ts` deps → `lib/mic-gate.ts` | 546 | **[COPY]** | Захват микрофона через noise-gate worklet, диагностика «немого» микрофона, `captureMic`/`releaseMicTrack`/`diagnoseMicTrack`. |
| `hooks/use-mic-gate-meter.ts` | 52 | **[COPY]** | Индикатор уровня микрофона (порог гейта). |
| `hooks/use-room-settings-sync.ts` + `stores/room-settings-store.ts` | — | **[ADAPT/опц.]** | Настройки шумоподавления/порога. Можно перенести упрощённо или захардкодить дефолты. |
| `public/noise-gate-worklet.js` | 259 | **[COPY]** | AudioWorklet: шумоподавляющий гейт (публикуемая дорожка = выход WebAudio). |
| `public/pcm-capture-worklet.js` | 182 | **[COPY]** | AudioWorklet: измерение уровня PCM для индикатора. |
| `public/aec-worklet.js` | 816 | **[COPY опц.]** | Эхоподавление. Тяжёлый; переносить если нужно AEC. |
| `stores/call-store.ts` | 70 | **[ADAPT]** | Zustand: `incoming`/`outgoing` звонок. В telemed уже есть `src/stores/call-store.ts` — заменяем на модель replixo. |
| `hooks/dm/use-calls.ts` | ~260 | **[ADAPT]** | Клиент дозвона (`useCallsRealtime`/`useCallActions`). Перевести с namespace `/dm` на чат-сокет telemed. |

### 1.3 UI комнаты (`replixo/app/room/[roomId]/`, `replixo/components/`)

| Файл | Действие | Назначение |
|------|----------|------------|
| `app/room/[roomId]/room-client.tsx` | **[ADAPT]** | Главный клиент комнаты. Убираем chat/whiteboard/annotation/overlay/settings-доску. |
| `app/room/[roomId]/room-video-grid.tsx` | **[ADAPT]** | Сетка видео: локальное + удалённые + демонстрация. |
| `app/room/[roomId]/room-controls.tsx` | **[ADAPT]** | Кнопки: микрофон, камера, демонстрация, выбор микрофона, качество демонстрации, «выйти». |
| `app/room/[roomId]/room-header.tsx`, `room-status.tsx` | **[ADAPT]** | Шапка (кол-во участников), экраны `idle/connecting/error`. |
| `components/network-banner.tsx`, `components/enable-sound-banner.tsx` | **[COPY]** | Баннер «видео отключено из-за сети» и «нажмите, чтобы включить звук» (autoplay policy). |
| `app/room/[roomId]/room-chat.tsx`, `room-overlay-layer.tsx`, `floating-chat-button.tsx`, `chat-*`, `use-annotation-overlay.ts`, `use-chat-panel.ts`, `room-settings-dialog.tsx` | **[SKIP]** | Чат/доска/аннотации/overlay/настройки. |
| `components/whiteboard.tsx`, `components/annotation-*` | **[SKIP]** | Доска и аннотации. |

---

## 2. Целевая архитектура в telemed

### 2.1 Процессы (без изменений в модели запуска)

| Скрипт | Файл | Порт | Роль |
|--------|------|------|------|
| `pnpm dev` | Next.js | 3000 | Приложение + Payload + API + **страница комнаты `/appointment/[id]/call`** |
| `pnpm socket` | `src/server.ts` → `src/lib/socket/*` | `SOCKET_PORT` | Чат **+ дозвон (ringing)**: `call-invite/incoming/answer/...` |
| `pnpm mediasoup` | `src/mediasoup-server.ts` | `MEDIASOUP_PORT` | **SFU-звонок (комнаты replixo) + запись FFmpeg** |
| ~~`pnpm peer`~~ | ~~`src/peer-server.ts`~~ | — | **Удаляется** |

### 2.2 Поток звонка (врач ↔ пациент)

```
1. Врач в /lk-med/chat нажимает «Позвонить»
      └─ chat-socket: emit('call-initiate', { appointmentId, isAudioOnly })   [существующий callHandler]
2. Сервер чата рассылает 'incoming-call' пациенту (все его сокеты) + сохраняет в activeCallsStore
3. Пациент видит экран входящего вызова (звонок в call-store), рингтон
4. Пациент жмёт «Принять»
      └─ chat-socket: emit('call-answer') → сервер шлёт 'call-answered' обоим
5. Обе стороны переходят полной навигацией на  /appointment/<id>/call
6. Страница комнаты монтирует useMediasoup(`appointment_<id>`, displayName)
      └─ mediasoup-socket: emit('joinRoom', { roomId, peerId, displayName, rtpCapabilities })
      └─ первый пришедший поднимает Room (router), второй подключается к существующей
7. Обмен транспортами/producers/consumers по протоколу §3 → видео/аудио/экран текут через SFU
8. Врач жмёт «Записать» → mediasoup-socket emit('start-recording') → FFmpeg (recorder.ts)
9. Любой жмёт «Выйти» → leaveRoom + navigate; врач может завершить консультацию (existing flow)
```

**Ключевое отличие от replixo:** дозвон в replixo — namespace `/dm` + `areFriends`. В telemed —
**уже существующий** `callHandler` в чат-сокете с моделью `doctor`/`user` и проверкой доступа к
`appointment`. Мы НЕ тащим DM-дозвон; мы **добавляем в существующий ringing переход в комнату**.

### 2.3 Транспорт сигналинга

- **Медиа-сигналинг** (joinRoom/produce/consume/...) — отдельный Socket.IO сервер
  `src/mediasoup-server.ts`, клиент подключается по `NEXT_PUBLIC_MEDIASOUP_URL`
  (`resolveServerUrl()` из `types.ts`).
- **Дозвон** (incoming-call/answer/...) — чат-сокет `src/server.ts`, клиент — существующий
  `src/components/socket-provider.tsx`.

---

## 3. Полный протокол сигналинга MediaSoup (клиент ↔ `src/mediasoup-server.ts`)

Все события идут с ack-callback `(err: string | null, data?) => void`. Имена — как в replixo
(camelCase). **Важно:** это НЕ те имена, что в текущем telemed (`join-room`, `create-transport`,
kebab-case) — при переносе клиента и сервера имена событий должны совпадать. Берём набор replixo.

### 3.1 Клиент → сервер

| Событие | Payload | Ack | Назначение |
|---------|---------|-----|------------|
| `joinRoom` | `{ roomId, peerId, displayName, rtpCapabilities, create?, clientId }` | `{ rtpCapabilities, existingPeers: [{ peerId, displayName, producers:[{producerId,kind,appData}] }] }` | Вход в комнату, получение router caps + список существующих продюсеров. |
| `resetMediaState` | `{ roomId, peerId }` | `void` | Полная пересборка транспортов без выхода из комнаты (rebuild). |
| `createWebRtcTransport` | `{ roomId, peerId, direction: 'send'\|'recv' }` | `{ transportId, iceParameters, iceCandidates, dtlsParameters, iceServers }` | Создать транспорт. |
| `connectTransport` | `{ roomId, peerId, transportId, dtlsParameters }` | `void` | DTLS-хендшейк. |
| `restartIce` | `{ roomId, peerId, transportId }` | `iceParameters` | ICE-restart после обрыва/VPN. Ошибка `transport-gone` → клиент делает rebuild. |
| `produce` | `{ roomId, peerId, transportId, kind, rtpParameters, appData }` | `{ producerId }` | Опубликовать дорожку. `appData.source: 'media'\|'screen'`. |
| `consume` | `{ roomId, peerId, producerId, rtpCapabilities }` | `{ consumerId, producerId, kind, rtpParameters, producerPaused, appData }` | Подписаться (консьюмер создаётся `paused`). |
| `resumeConsumer` | `{ roomId, peerId, consumerId }` | `void` | Возобновить консьюмер (+ сервер шлёт keyframe-ретраи). |
| `closeConsumer` | `{ roomId, peerId, consumerId }` | `void` | Точечное восстановление приёма (черный кадр). |
| `pauseConsumer` | `{ roomId, peerId, consumerId, paused }` | `void` | Локальная защита downlink: пауза/резюм одного консьюмера. |
| `setConsumerLayers` | `{ roomId, peerId, consumerId, spatialLayer, temporalLayer }` | `void` | Прижать simulcast-слой (мягкая деградация вместо паузы). |
| `requestConsumerKeyFrame` | `{ roomId, peerId, consumerId }` | `void` | Запрос keyframe при чёрном кадре. |
| `closeProducer` | `{ roomId, peerId, producerId }` | `void` | Остановить продюсер (конец демонстрации). |
| `pauseProducer` | `{ roomId, peerId, producerId, paused }` | `void` | Mute/unmute (пауза/резюм продюсера). |
| `rejoinProbe` | `{ roomId, peerId, clientId }` | `void` (err если evicted) | Проверка «сервер ещё держит пира» после reconnect socket.io. |
| `leaveRoom` | `{ roomId, peerId }` | — | Явный выход. |
| **HTTP** `POST /rooms/:roomId/leave?peerId=` | (sendBeacon) | 204 | Быстрое закрытие вкладки (короткое grace-окно). |

### 3.2 Сервер → остальным пирам комнаты

| Событие | Payload | Назначение |
|---------|---------|------------|
| `peerJoined` | `{ peerId, displayName }` | Новый участник вошёл. |
| `peerLeft` | `{ peerId }` | Участник вышел/evicted. |
| `newProducer` | `{ peerId, displayName, producerId, kind, appData }` | Появился новый продюсер → остальные вызывают `consume`. |
| `producerClosed` | `{ peerId, producerId }` | Продюсер закрыт (конец демонстрации / reset). |
| `producerPaused` | `{ peerId, producerId, paused }` | Mute-индикатор. |
| `kicked` | `{ reason: 'duplicate' }` | Дубликат-вкладка выкинута (терминально на клиенте). |

### 3.3 Дополнительно для записи (telemed-специфика, §8)

| Событие | Payload | Ack |
|---------|---------|-----|
| `start-recording` | `{ roomId, recordingType }` | `{ sessionId }` |
| `stop-recording` | `{ roomId }` | `{ filePath, recordingId }` |
| `get-recording-status` | `{ roomId }` | `{ isRecording, sessionId, startedAt }` |
| (broadcast) `recording-started` / `recording-stopped` | `{ sessionId, ... }` | — |

---

## 4. Серверная часть — пошаговый перенос

Целевой каталог: `src/lib/mediasoup/` (существующий) + новый подкаталог сигналинга.

Предлагаемая структура:

```
src/mediasoup-server.ts                 [ADAPT] точка входа (worker + io + beacon + graceful shutdown)
src/lib/mediasoup/
├── config.ts                           [REUSE] worker/router/webRtcServer/recording — уже есть
├── worker-manager.ts                   [REUSE] пул воркеров — уже есть
├── recorder.ts                         [REUSE] FFmpeg-запись → Payload — уже есть
├── Room.ts                             [ADAPT] класс комнаты из replixo (адаптация транспортов)
├── Peer.ts                             [COPY]  класс пира из replixo
├── room-code.ts                        [ADAPT] canonicalRoomCode под appointment_<id>
├── client-types.ts                     [REUSE] (если нужны общие типы)
└── signaling/
    ├── helpers.ts                      [COPY]  ack/err/rate-limit/context
    ├── room-registry.ts                [ADAPT] реестр комнат + grace + duplicate-kick
    ├── media-handlers.ts               [ADAPT] joinRoom/transports/produce/consume/... + запись
    └── lifecycle-handlers.ts           [COPY]  rejoinProbe/leaveRoom/disconnect
```

### 4.1 `helpers.ts` **[COPY]**
Перенести без изменений: `ack`, `err` (с guard `typeof cb === 'function'` — критично, иначе краш
всего процесса при отсутствии callback), `createRateLimiter(limit, windowMs)`, `SocketSession`,
`HandlerContext { io, socket, session }`.

### 4.2 `Peer.ts` **[COPY]**
Перенести целиком: `transports/producers/consumers: Map`, `addTransport/getTransport`, `addProducer`,
`addConsumer`, `resetMedia()` (закрывает транспорты, чистит все Map), `close()`.

### 4.3 `Room.ts` **[ADAPT]** — ключевой файл
Перенести весь класс replixo, но **адаптировать создание транспорта под telemed webRtcServer**:

- **Router codecs**: заменить replixo `mediaCodecs` на `routerOptions.mediaCodecs` из telemed
  `config.ts` (там VP8+VP9+H264). `Room.create(id, worker)` → `worker.createRouter(routerOptions)`.
  > Внимание: под simulcast/`setConsumerPreferredLayers` достаточно VP8. Оставляем набор telemed.
- **`createWebRtcTransport(peerId, direction)`**: использовать telemed `webRtcServerOptions`
  (единый порт `MEDIASOUP_WEBRTC_PORT=13478`) вместо replixo per-transport listenIps + диапазон
  40000–49999. То есть `router.createWebRtcTransport({ webRtcServer, ...webRtcTransportOptions, appData:{direction} })`.
  > worker-manager telemed создаёт `webRtcServer` на воркере — получить его оттуда.
- **Сохранить из replixo (важные детали, которых нет в telemed):**
  - замена «одного транспорта на direction» — старый recv/send закрывается при повторном создании;
  - `transport.setMaxIncomingBitrate(8_000_000)`, для recv `setMaxOutgoingBitrate(8_000_000)`;
  - `dtlsstatechange === 'closed' → transport.close()`;
  - `transport.observer.once('close')` → удалить из `peer.transports` (иначе `restartIce` найдёт
    мёртвый объект и уронит медиасессию в цикл);
  - `iceServers` в ack `createWebRtcTransport` (TURN обязателен для мобильных за CGNAT!);
  - `restartIce()` с маркером ошибки `transport-gone`;
  - `consume()` — консьюмер `paused: true`, поиск recv-транспорта по `appData.direction`,
    `router.canConsume` guard;
  - `resumeConsumer()` — ретраи `requestKeyFrame` по расписанию `[0,200,600,1200,2500]ms`
    (лечит вечный чёрный кадр на TURN-путях);
  - `setConsumerPreferredLayers()` + `topLayersOf()` (динамический потолок simulcast);
  - `requestConsumerKeyFrame()`, `pauseConsumer/resumeConsumer`, `closeConsumer` (возвращает
    `{producerId, kind}`), `pause/resumeProducer`, `closeProducer`;
  - `getExistingPeersFor(peerId)`, `isFull()` (лимит `MAX_PEERS_PER_ROOM`).
- **Убрать из replixo Room:** `currentSlide`, `whiteboardOpen/Snapshot`, `presentationDrawings` и
  всё, что с ними связано.
- **`MAX_PEERS_PER_ROOM`**: для telemed достаточно **2** (врач + пациент). Оставить константу,
  выставить 2 (или 3 с запасом).

### 4.4 `room-registry.ts` **[ADAPT]**
Перенести целиком, **убрать** гидрацию `getWhiteboard/getPresentationDrawings` и вызовы
`deleteRoomMessages/deleteRoomUploads` из `cleanupRoomIfEmpty` (в telemed истории комнаты в БД нет).

Обязательно сохранить (это и есть «устойчивость» replixo):
- `rooms: Map`, `peerSockets: Map` (ключ `roomId\0peerId`), `peerClients: Map` (nonce страницы);
- **grace-окна**: `DISCONNECT_GRACE_MS = 45000` (обрыв сети/блокировка телефона),
  `CLOSE_GRACE_MS = 6000` (beacon «закрываю вкладку»), `CLEAN_CLOSE_GRACE_MS = 10000`
  (чистый close без beacon);
- `markClosing/isClosing`, `scheduleEviction`, `clearPendingDisconnect`, `deletePendingDisconnect`;
- `evictPeer(io, roomId, peerId, expectedSocketId?)` — идемпотентно, шлёт `peerLeft`,
  чистит `peerSockets/peerClients`, вызывает `cleanupRoomIfEmpty`;
- `getOrCreateRoom(roomId, worker)`;
- `authedRoom(rid, pid, socketId)`.
- **Про `allowRoomCreation/isRoomCreationAllowed`**: в replixo нужно, т.к. код комнаты рандомный и
  «создателя» нет. В telemed `roomId = appointment_<id>` детерминирован → **упрощаем**: разрешаем
  создание комнаты любому пиру, прошедшему проверку доступа к appointment (см. §4.10). Можно вовсе
  убрать флаг `create` и `creatableRooms`, либо оставить `create=true` для обоих участников.

### 4.5 `media-handlers.ts` **[ADAPT]**
Перенести все обработчики из §3.1. Изменения:
- В ack `joinRoom` **убрать** `currentSlide/messages/readMarkers/whiteboard*/presentationDrawings` —
  оставить только `{ rtpCapabilities, existingPeers }`.
- Убрать импорты `getRoomMessages/getRoomReadMarkers` и функции `optional()` для чата.
- Сохранить `withTimeout` для `getOrCreateRoom` (15s) — чтобы висящий воркер не оставлял клиента в
  вечном «Подключение к комнате».
- Сохранить `ownsPeer()` guard на `produce/consume/resume/close/reset`.
- Сохранить duplicate-kick логику в `joinRoom` (сравнение `clientId`, `kicked`-эмит).
- **Добавить интеграцию записи** (из текущего telemed `mediasoup-server.ts`): в обработчике
  `produce`, после создания продюсера — если для комнаты есть активная запись,
  `recorder.addProducerToRecording(...)` (см. §8).

### 4.6 `lifecycle-handlers.ts` **[COPY]**
Перенести целиком: `rejoinProbe` (проверка владельца через `clientId`), `leaveRoom`, `disconnect`
с выбором grace-окна по причине (`client namespace disconnect`/`transport close`/beacon).

### 4.7 `socket.ts` → интеграция в `src/mediasoup-server.ts` **[ADAPT]**
Сейчас telemed `mediasoup-server.ts` содержит всю логику инлайн (join-room и т.д.). Переписываем:
```
main():
  await workerManager.initialize()                 // [REUSE]
  worker = workerManager.getWorker()               // взять воркер(ы)
  httpServer = createServer(...)                    // health + beacon POST /rooms/:id/leave
  io = new SocketIOServer(httpServer, {
    cors: { origin: serverConfig.corsOrigins, credentials: true },
    pingTimeout: 30000, pingInterval: 10000,        // из replixo — переживает 5с обрыва
    transports: ['websocket','polling'],
  })
  io.on('connection', socket => {
    const session = { roomId:null, peerId:null }
    const ctx = { io, socket, session }
    registerMediaHandlers(ctx, worker)
    registerLifecycleHandlers(ctx)
    registerRecordingHandlers(ctx)                  // telemed-специфика (§8)
  })
  // beacon endpoint (markClosing + scheduleEviction), graceful shutdown (SIGINT/SIGTERM)
```
Порт запуска — `serverConfig.port` (`MEDIASOUP_PORT`, сейчас 3002).

### 4.8 Beacon-эндпоинт `/rooms/:roomId/leave` **[COPY идею из replixo index.ts]**
`POST` с `?peerId=`, вызываемый `navigator.sendBeacon` на `pagehide/beforeunload`. Ставит
`markClosing` + `scheduleEviction` с `CLOSE_GRACE_MS`. Отвечает 204 сразу.

### 4.9 `room-code.ts` **[ADAPT]**
Заменить регэксп кода `ABCD-EFGH` на валидацию `appointment_<number>`:
```ts
export function canonicalRoomId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m = /^appointment_(\d+)$/.exec(value.trim())
  return m ? `appointment_${m[1]}` : null
}
```
Использовать в `joinRoom`/`leave`/beacon вместо replixo `canonicalRoomCode`. Клиентский
`peerIdKey` (localStorage) тоже переводим на этот формат.

### 4.10 Авторизация доступа к комнате **[NEW, важно]**
В replixo комната защищена секретностью кода. В telemed roomId предсказуем (`appointment_5`),
поэтому нужна **проверка доступа**:
- Вариант A (рекомендуется): при `call-answer`/переходе в комнату чат-сокет (он аутентифицирован
  cookie) выдаёт **короткоживущий токен** для appointment; клиент передаёт его в `joinRoom`
  payload; mediasoup-сервер проверяет подпись (`MEDIASOUP_SERVER_SECRET` / `PAYLOAD_SECRET`).
- Вариант B (минимальный): mediasoup-сервер при `joinRoom` дергает внутренний Next-роут
  `/api/appointments/:id/verify-participant` (по `MEDIASOUP_SERVER_SECRET`), который проверяет, что
  `peerId` соответствует врачу/пациенту этого appointment.
- `peerId` строим детерминированно: `doctor_<doctorId>` / `user_<userId>` — тогда duplicate-kick
  работает между вкладками одного участника, а доступ легко валидируется.

---

## 5. Клиентская часть — пошаговый перенос

Целевой каталог: `src/hooks/mediasoup/` + `src/lib/mediasoup-client/` (mic-gate и пр.).

### 5.1 `hooks/mediasoup/types.ts` **[ADAPT]**
Перенести целиком все константы (они self-contained и очень ценные):
- `SCREEN_QUALITY_PRESETS` (auto/720p/1080p + maxBitrate),
- `CAMERA_ENCODINGS` (3 simulcast-слоя: 100k/300k/900k), `CAMERA_PRODUCE_OPTIONS`,
- `VOICE_CODEC_OPTIONS` (opusFec/opusDtx/opusPtime:40/maxAvg:64k), `VOICE_PRODUCE_OPTIONS`,
- `NETWORK_GUARD` (все пороги слабой сети — см. значения ниже),
- `resolveServerUrl()` → `SERVER_URL` (использует `NEXT_PUBLIC_MEDIASOUP_URL`, иначе origin/nginx,
  иначе `http://localhost:3001` — заменить дефолт на telemed-порт при необходимости),
- `CLIENT_ID` (nonce страницы), `getOrCreatePeerId(roomId)`.

**Адаптация `peerId`:** заменить localStorage-случайный id на детерминированный по роли:
`doctor_<id>` или `user_<id>` (получать из user-store/doctor-store). Это одновременно даёт
duplicate-kick и позволяет серверу проверять доступ (§4.10).

Значения `NETWORK_GUARD` (перенести как есть):
```
SAMPLE_INTERVAL_MS 2000 · BAD_SAMPLES_TO_SUPPRESS 3 · GOOD_SAMPLES_TO_RESTORE 5
MIN_SUPPRESSION_MS 15000 · MAX_SUPPRESSION_MS 120000 · FLAP_WINDOW_MS 60000
WEAK_LOSS 0.04 · BAD_LOSS 0.12 · MIN_LOSS_WINDOW_PACKETS 12
WEAK_CONCEALMENT 0.06 · BAD_CONCEALMENT 0.15 · STALLED_SAMPLES_TO_BAD 2
BAD_UPLINK_BPS 180000 · WEAK_UPLINK_BPS 400000 · BAD_DOWNLINK_BPS 250000 · WEAK_DOWNLINK_BPS 600000
BAD_RTT_S 1.0 · VOICE_BITRATE {good64k,weak40k,bad24k}
LOW_SPATIAL_LAYER 0 · LOW_TEMPORAL_LAYER 0 · LOW_CAMERA_BPS 120000 · LOW_CAMERA_FPS 15
LOW_SCREEN_BPS 500000 · LOW_SCREEN_FPS 5 · FORCE_VIDEO_TTL_MS 60000
```

### 5.2 `hooks/use-mediasoup.ts` **[ADAPT]**
Перенести главный хук. Убрать:
- sub-хуки `useChat`, `useWhiteboard` и связанные refs/возвраты;
- поля ack `messages/readMarkers/whiteboard*`;
- экшены reducer чата/доски.

Сохранить всё ядро надёжности:
- `REBUILD_COOLDOWN_MS = 30000`, `JOIN_ACK_TIMEOUT_MS = 15000`;
- полный набор refs (socket/device/send/recv транспорты, producers, `hasJoinedRef`, `kickedRef`,
  `connectionGenerationRef`, `audioPublishInFlightRef`, `videoConsumersSuppressedRef` и т.д.);
- `assessSession()` (evidence-based: send/recv/mic/cam/screen broken) — использует `diagnoseMicTrack`
  и `isProducerOnStaleTransport`;
- `recoverConnection({force})` через `rejoinProbe` + точечный ремонт;
- `join()` (io-options: reconnection Infinity, delay 500→3000; `doJoinSequence`; catch-up publish
  микрофона после rejoin) и `leave()` (release mic через `releaseMicTrack`).

### 5.3 Суб-хуки **[COPY/ADAPT]**
- `use-transports.ts` **[COPY]** — `createTransport`, `setupTransports`, `consumeProducer`,
  `restartIceForTransport`, ICE-retry-ladder, respect `videoConsumersSuppressedRef`.
- `use-media-controls.ts` **[ADAPT]** — микрофон/камера/демонстрация + recovery. Убрать
  Electron-ветки (`captureElectronSource`, `followPresentationWindow`, `getLastDisplaySource`,
  `isElectronRuntime`) — в браузере это no-op; демонстрация через `getDisplayMedia`.
- `use-network-guard.ts` **[COPY]** — сэмплинг и деградация видео.
- `producer-transport.ts` **[COPY]**, `reducer.ts` **[ADAPT]** (убрать chat/whiteboard-экшены),
  `register-socket-listeners.ts` **[ADAPT]** (только медиа-события §3.2).

### 5.4 mic-gate + worklets **[COPY]**
- `lib/mic-gate.ts` → `src/lib/mediasoup-client/mic-gate.ts`. Зависит от `audio-unlock.ts`
  (getSharedAudioContext), `media-constraints.ts` (getVoiceAudioConstraints),
  `stores/room-settings-store.ts` (порог гейта) — **перенести и их** (или упростить дефолтами).
- `public/noise-gate-worklet.js`, `public/pcm-capture-worklet.js` → `public/` telemed.
  `public/aec-worklet.js` — по желанию (эхоподавление).
- `WORKLET_VERSION` — оставить механизм версионирования (worklet кешируется агрессивно).
- `hooks/use-mic-gate-meter.ts` **[COPY]** — индикатор уровня.

### 5.5 Зависимости
`mediasoup` (^3.19) и `mediasoup-client` (^3.19) **уже есть** в telemed `package.json` — новых
серверных/клиентских библиотек не требуется. Проверить, что worklets грузятся с правильным путём.

---

## 6. Слой дозвона (ringing) поверх чат-сокета telemed

**НЕ переносим** replixo `dm/call-handlers.ts` и namespace `/dm`. Вместо этого используем
**существующий** telemed `src/lib/socket/handlers/callHandler.ts`, который уже умеет:
`call-initiate → incoming-call`, `call-answer → call-answered`, `call-reject`, `call-end`,
`checkPendingCallsForSocket` (снапшот при подключении — аналог replixo `call:sync`).

Что делаем:
1. **Сохраняем** серверный `callHandler.ts` telemed как есть (модель doctor/user, `activeCallsStore`).
2. **Клиент дозвона**: адаптируем replixo `hooks/dm/use-calls.ts` → `src/hooks/use-calls.ts`,
   переведя события на telemed-имена (`incoming-call`/`call-answered`/`call-ended`) и на
   существующий `socket-provider`. Логика та же: `useCallsRealtime` (одна подписка на приложение,
   рингтон пока есть `incoming`), `useCallActions` (`invite/accept/decline/cancel`).
3. **`call-store`**: заменить текущий `src/stores/call-store.ts` на модель replixo
   (`incoming/outgoing` + `clearIncoming(callId)`/`clearOutgoing(callId)` с проверкой callId).
   В `IncomingCall/OutgoingCall` вместо `fromUserId` использовать `appointmentId` + имя собеседника.
4. **Переход в комнату**: на `call-answered` обе стороны делают
   `window.location.assign('/appointment/<id>/call')` (полная навигация — как в replixo `goToRoom`,
   чтобы комната поднимала свежее mediasoup-соединение с нуля).
5. Рингтон/уведомления: перенести `lib/sounds.ts` (`startRingtone`, `playCallEnded`) или
   переиспользовать существующие звуки telemed, если есть.

> Итог: медиа целиком в SFU; чат-сокет отвечает только за «звоним/приняли/отклонили/перейти в
> комнату», как и было задумано в плане.

---

## 7. UI комнаты и маршрут `/appointment/[id]/call`

### 7.1 Маршрут **[NEW]**
```
src/app/(frontend)/appointment/[id]/call/page.tsx          — RSC: грузит appointment, проверяет
                                                              доступ (врач/пациент), считает displayName
src/app/(frontend)/appointment/[id]/call/call-client.tsx   — 'use client': монтирует useMediasoup(
                                                              `appointment_${id}`, displayName)
```
`page.tsx`: определить роль по cookie (`doctors-token`/`payload-token`), проверить участие в
appointment, передать `roomId`, `displayName` (`doctorName`/`userName`), `role`, `appointmentId`.

### 7.2 Компоненты комнаты **[ADAPT из replixo room/[roomId]]**
```
src/components/call-room/room-client.tsx      — оркестратор (без name-gate: имя из appointment)
src/components/call-room/room-video-grid.tsx  — сетка: local + remote + screen
src/components/call-room/room-controls.tsx    — микрофон/камера/демонстрация/выбор микро/качество/выход
                                                + для врача: «Запись»/«Стоп»
src/components/call-room/room-header.tsx       — участники, длительность (переиспользовать CallTimer)
src/components/call-room/room-status.tsx       — idle/connecting/error/reconnecting
src/components/call-room/network-banner.tsx    — [COPY] «видео отключено из-за сети»
src/components/call-room/enable-sound-banner.tsx — [COPY] autoplay-разблокировка звука
```
Из `room-client.tsx` replixo **выпилить**: name-dialog (имя берём из appointment), chat panel,
whiteboard (dynamic import tldraw), annotation toolbar/overlay, RoomOverlayLayer, RoomSettingsDialog
(доска), Electron-ветки (`overlayMode`, `isElectron`), FloatingChatButton.

Сохранить: `beforeunload`-guard, `NetworkBanner`, `EnableSoundBanner`, permission/mic notice баннеры,
`handleToggleCam` (учёт `uplinkVideoSuppressed` → `noteUserWantsVideo`), `RoomVideoGrid`,
`RoomControls`, `handleLeave` (→ navigate назад в чат).

### 7.3 Стиль
Оформить в стиле telemed shadcn (`src/components/ui`) — использовать существующие `Button`,
`Dialog`, `Tooltip`, иконки `lucide-react`. Палитра/токены — из `globals.css` telemed. Не тащить
стили replixo дословно, только структуру и поведение.

### 7.4 Кнопки «Позвонить»
В `chat-header.tsx` / `doctor-chat-wrapper.tsx` / `chat-window.tsx` кнопки звонка → вызывают
`useCallActions().invite(appointmentId, ...)` вместо старого оверлея. При `call-answered` — переход
на `/appointment/[id]/call`.

---

## 8. Запись звонков **[REUSE telemed]**

Полностью переиспользуем существующую инфраструктуру записи telemed — replixo записи не имеет.

- `src/lib/mediasoup/recorder.ts` **[REUSE]** — PlainTransport + FFmpeg → WebM, `startRecording`,
  `stopRecordingByRoom`, `addProducerToRecording`, `getActiveRecordingForRoom`. `roomId` формата
  `appointment_<id>` уже парсится (`roomId.replace('appointment_', '')`).
- **Хуки записи в новом media-handlers** (перенести из текущего `mediasoup-server.ts`):
  - в `produce` — если есть активная запись комнаты → `addProducerToRecording`;
  - события `start-recording`/`stop-recording`/`get-recording-status` (только для `role === 'doctor'`);
  - `stop-recording` вызывает `POST /api/mediasoup-recording/finalize-server` с
    `MEDIASOUP_SERVER_SECRET`.
- Маршруты `/api/mediasoup-recording/finalize` и `/finalize-server` **[REUSE]**.
- Коллекция `call-recordings` **[REUSE]** (appointment, doctor, recordingType, video, durationSeconds).
- **Роль/`role`** прокидывается в `joinRoom` payload и хранится в `Peer`/session (нужно для проверки
  «только врач записывает»). Добавить `role` в `JoinRoomPayload` и в `Peer` (или в session).

> chunk-запись PeerJS (`/api/recording-chunks*`) — удаляется вместе с PeerJS (§9).

---

## 9. Зачистка

**Удалить (PeerJS + старая система звонков):**
```
src/peer-server.ts
src/components/video-call/**                      (вся папка: провайдеры, views, components, hooks)
src/lib/video-call/**                              (config/types старого звонка)
src/app/api/recording-chunks/**                    (chunk-запись PeerJS)
```
**Проверить и убрать использования (сначала usage, потом импорт):**
- `src/app/(frontend)/layout.tsx` — убрать `VideoCallProviderWrapper` и `VideoCallOverlay`, вместо
  них подключить (если нужно глобально) `DmNotifier`-аналог для дозвона (рингтон/входящий экран).
- `src/components/chat/*` — заменить триггеры звонка на `useCallActions`.
- `src/components/socket-provider.tsx` — оставить (чат-сокет), подключить `useCallsRealtime`.
- `src/stores/call-store.ts` — заменить содержимое на модель replixo.
- `src/lib/socket/handlers/callHandler.ts` — оставить (это ringing), при необходимости причесать.

**`package.json`:**
- удалить скрипт `"peer"` и зависимости `peer`, `peerjs`;
- скрипт `"mediasoup"` — оставить (`node src/mediasoup-server.ts`).

**Payload / коллекции:** поле `Appointments.activeCall` и `connectionType` — оставить (используются
чатом и типом связи). `recording` — оставить.

---

## 10. Переменные окружения

Сопоставление replixo → telemed (большинство уже есть в telemed, см. SITE_INFORMATION.md):

| Назначение | replixo | telemed | Комментарий |
|------------|---------|---------|-------------|
| Порт SFU | `PORT` (3001) | `MEDIASOUP_PORT` (3002) | Оставляем telemed. |
| CORS | `CLIENT_ORIGIN` | `MEDIASOUP_CORS_ORIGINS` | Оставляем telemed. |
| URL SFU (клиент) | `NEXT_PUBLIC_MEDIASOUP_URL` | `NEXT_PUBLIC_MEDIASOUP_URL` | Уже есть. |
| Путь socket.io | — | `NEXT_PUBLIC_MEDIASOUP_PATH` | Уже есть. |
| Announced IP | `ANNOUNCED_IP` | `MEDIASOUP_ANNOUNCED_IP` | Публичный IP/домен сервера. |
| Listen IP | (0.0.0.0) | `MEDIASOUP_LISTEN_IP` | Уже есть. |
| WebRTC порт | (40000–49999) | `MEDIASOUP_WEBRTC_PORT` (13478) | Единый порт (WebRtcServer). |
| STUN | `STUN_URL` | **[NEW]** `MEDIASOUP_STUN_URL` (опц.) | По умолчанию Google STUN. |
| TURN | `TURN_URL`,`TURN_USERNAME`,`TURN_CREDENTIAL` | **[NEW]** `MEDIASOUP_TURN_URL/USERNAME/CREDENTIAL` | **Критично для мобильных за CGNAT.** telemed сейчас использует Metered — можно оставить его. |
| Секрет сервера | `INTERNAL_HOOK_SECRET` | `MEDIASOUP_SERVER_SECRET` | Для finalize-записи и verify-participant. |
| FFmpeg | — | `FFMPEG_PATH`, `RECORDING_OUTPUT_DIR` | Уже есть. |
| Next URL | — | `NEXTJS_URL` | Для finalize-роута. |

> Задача: добавить чтение TURN/STUN из env в telemed `config.ts` (сейчас ICE для recorder не нужен,
> но для `createWebRtcTransport` ответа клиенту нужен `iceServers` — перенести блок из replixo
> `config.ts`: `customTurnUrls`, `iceServers`).

---

## 11. Nginx

Проксирование (как в replixo `nginx.md`), добавить в существующий `scripts/setup-nginx.sh`:
- WebSocket-апгрейд для mediasoup socket.io:
  ```
  location /mediasoup/ {                     # или NEXT_PUBLIC_MEDIASOUP_PATH
    proxy_pass http://127.0.0.1:3002/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
  }
  ```
- Чат-сокет (`SOCKET_PORT`) — уже настроен.
- **WebRTC-порт `MEDIASOUP_WEBRTC_PORT` (13478/udp + /tcp)** проксировать нельзя — открыть в firewall
  напрямую: `sudo ufw allow 13478/udp && sudo ufw allow 13478/tcp`.
- beacon `POST /rooms/:id/leave` должен доходить до mediasoup (через тот же `/mediasoup/` location).

---

## 12. Запуск (dev / prod)

**Dev (3 процесса):**
```
pnpm dev        # Next.js :3000
pnpm socket     # чат + дозвон :SOCKET_PORT
pnpm mediasoup  # SFU + запись :MEDIASOUP_PORT
```
Требуется установленный FFmpeg (`FFMPEG_PATH`) для записи.

**Prod:** те же три процесса под pm2/systemd + nginx (§11) + firewall для WebRTC-порта + рабочий
TURN. После изменения схемы: `pnpm generate:types`; после кастомных admin-компонентов:
`pnpm generate:importmap`.

---

## 13. План тестирования

1. **Базовый звонок врач↔пациент**: инициатор звонит → у второго входящий + рингтон → принял →
   оба в `/appointment/<id>/call` → видят/слышат друг друга; mute/unmute; вкл/выкл камеры.
2. **Демонстрация экрана**: врач шарит экран → пациент видит; остановка демонстрации (`producerClosed`).
3. **Reconnect**: у одного вырубить Wi-Fi на ~10с → сессия восстанавливается (ICE-restart), участник
   НЕ «исчезает» у второго (grace-окно 45s).
4. **Закрытие вкладки**: закрыть вкладку → второй видит выход через ~6–10с (beacon/clean-close),
   а не через минуту.
5. **Дубликат вкладки**: открыть комнату во второй вкладке того же профиля → старая получает `kicked`.
6. **Слабая сеть** (throttle): видео деградирует (слой↓) → при ухудшении пропадает, голос жив;
   при восстановлении видео возвращается (не «мигает»); баннер NetworkBanner показывается.
7. **Запись**: врач жмёт «Запись» → `start-recording` → говорят 20с → «Стоп» → `finalize-server` →
   в `call-recordings` появляется запись, `video` в Media, длительность корректна.
8. **Мобильный за CGNAT** (реальный телефон по мобильному интернету) — проверить, что слышно/видно
   (это и есть проверка TURN).
9. **Права**: пациент НЕ может запускать запись (`role !== 'doctor'`); чужой пользователь не может
   войти в `appointment_<id>` (проверка доступа §4.10).

---

## 14. Проверки готовности

- `pnpm exec tsc --noEmit` — без ошибок типов.
- `pnpm lint` — чисто.
- `pnpm generate:types` (если менялись коллекции).
- Ручной прогон сценариев §13 (минимум 1, 3, 4, 6, 7).
- В логах mediasoup — префиксы `[room]`, `[media]`, `[socket]`, `[Recorder]` без циклов
  restart↔rebuild.

---

## 15. Пошаговый чек-лист миграции (порядок работ)

1. **Ветка** от `main`, добавить env-переменные TURN/STUN/секрет.
2. **Сервер — ядро**: перенести `helpers.ts`, `Peer.ts`, `room-registry.ts`, `lifecycle-handlers.ts`
   в `src/lib/mediasoup/signaling/`.
3. **Сервер — Room**: перенести `Room.ts`, адаптировать транспорты под `webRtcServerOptions` telemed
   + перенести блок `iceServers`/TURN в `config.ts`. Убрать whiteboard/presentation.
4. **Сервер — media-handlers**: перенести, урезать ack `joinRoom`, добавить `role` и хуки записи.
5. **Сервер — вход**: переписать `src/mediasoup-server.ts` (io + хендлеры + beacon + shutdown),
   `room-code.ts` под `appointment_<id>`, добавить проверку доступа (§4.10).
6. **Запустить `pnpm mediasoup`** — убедиться, что стартует, `/health` отвечает.
7. **Клиент — константы**: перенести `hooks/mediasoup/types.ts` (адаптировать `peerId` под роль,
   `SERVER_URL`).
8. **Клиент — mic-gate**: перенести `mic-gate.ts` + зависимости + worklets в `public/`.
9. **Клиент — суб-хуки**: `producer-transport`, `use-transports`, `use-network-guard`,
   `use-media-controls` (убрать Electron), `reducer`, `register-socket-listeners`.
10. **Клиент — главный хук**: перенести `use-mediasoup.ts`, убрать chat/whiteboard.
11. **UI комнаты**: создать маршрут `/appointment/[id]/call` + компоненты `call-room/*` (shadcn).
12. **Дозвон**: адаптировать `use-calls.ts` под чат-сокет + новый `call-store`, подключить рингтон,
    переход в комнату на `call-answered`, привязать кнопки «Позвонить».
13. **Запись**: проверить `produce`-хук + `start/stop-recording` + finalize.
14. **Зачистка**: удалить `video-call/*`, `peer-server.ts`, `lib/video-call/*`,
    `api/recording-chunks/*`; поправить `layout.tsx`, `package.json` (убрать peer).
15. **Проверки**: `tsc --noEmit`, `pnpm lint`, прогон §13.
16. **Nginx/firewall** для прод-окружения.

---

## 16. Приложение — сводная таблица соответствия файлов

| replixo | → | telemed |
|---------|---|---------|
| `server/src/helpers.ts` (socket/) | → | `src/lib/mediasoup/signaling/helpers.ts` |
| `server/src/Peer.ts` | → | `src/lib/mediasoup/Peer.ts` |
| `server/src/Room.ts` | → | `src/lib/mediasoup/Room.ts` (адаптация webRtcServer) |
| `server/src/socket/room-registry.ts` | → | `src/lib/mediasoup/signaling/room-registry.ts` |
| `server/src/socket/media-handlers.ts` | → | `src/lib/mediasoup/signaling/media-handlers.ts` (+запись) |
| `server/src/socket/lifecycle-handlers.ts` | → | `src/lib/mediasoup/signaling/lifecycle-handlers.ts` |
| `server/src/socket.ts` + `index.ts` (частично) | → | `src/mediasoup-server.ts` |
| `server/src/room-code.ts` | → | `src/lib/mediasoup/room-code.ts` (appointment_<id>) |
| `server/src/config.ts` (ICE/TURN блок) | → | `src/lib/mediasoup/config.ts` (дополнить iceServers) |
| `hooks/use-mediasoup.ts` | → | `src/hooks/use-mediasoup.ts` |
| `hooks/mediasoup/*` | → | `src/hooks/mediasoup/*` |
| `lib/mic-gate.ts` (+audio-unlock, media-constraints) | → | `src/lib/mediasoup-client/*` |
| `public/*-worklet.js` | → | `public/*-worklet.js` |
| `stores/call-store.ts` | → | `src/stores/call-store.ts` (замена) |
| `hooks/dm/use-calls.ts` | → | `src/hooks/use-calls.ts` (на чат-сокет) |
| `app/room/[roomId]/room-*.tsx` | → | `src/components/call-room/*` + `src/app/(frontend)/appointment/[id]/call/*` |
| `components/network-banner.tsx`, `enable-sound-banner.tsx` | → | `src/components/call-room/*` |
| **[SKIP]** chat/whiteboard/presentation/annotation/dm/uploads/electron | → | — |
| **[REUSE]** — | — | `config.ts`, `worker-manager.ts`, `recorder.ts`, `call-recordings`, finalize-роуты, чат-сокет |
```
