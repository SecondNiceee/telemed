# План миграции: PeerJS → MediaSoup

> **Статус:** Фаза 1-4 завершены, готово к тестированию  
> **Дата создания:** 27.04.2026  
> **Обновлено:** 29.04.2026  
> **Цель:** Перенос записи видеозвонков на сторону сервера

---

## TURN серверы и порт 3002

### Вопрос: Будут ли работать те же TURN серверы?

**Да!** MediaSoup использует стандартный WebRTC, поэтому те же TURN серверы (`nice-sites.online`) будут работать без изменений.

### Текущая конфигурация TURN (используется и для PeerJS, и для MediaSoup):

```typescript
// src/lib/video-call/config.ts
export const ICE_SERVERS = [
  { urls: 'stun:nice-sites.online:3478' },
  {
    urls: 'turn:nice-sites.online:3478',
    username: 'testuser',
    credential: 'TestPass123',
  },
  {
    urls: 'turn:nice-sites.online:3478?transport=tcp',
    username: 'testuser',
    credential: 'TestPass123',
  },
  {
    urls: 'turns:nice-sites.online:5349',
    username: 'testuser',
    credential: 'TestPass123',
  },
]
```

### Порт 3002: PeerJS vs MediaSoup

| Параметр | PeerJS (сейчас) | MediaSoup (цель) |
|----------|-----------------|------------------|
| **Порт** | 3002 | 3002 (тот же!) |
| **Протокол** | HTTP + WebSocket | HTTP + WebSocket |
| **Роль** | Signaling only | SFU + Signaling |
| **Файл сервера** | `src/peer-server.ts` | `src/mediasoup-server.ts` |
| **npm script** | `pnpm peer` | `pnpm mediasoup` |

### Как TURN используется по-разному:

```
PeerJS (P2P):
  Пациент ◄──── TURN relay ────► Врач
  (медиа через TURN если прямое P2P не работает)

MediaSoup (SFU):
  Пациент ──── TURN ────► MediaSoup Server ◄──── TURN ──── Врач
  (TURN помогает клиентам подключиться к серверу через NAT)
```

**Вывод:** Замена PeerJS на MediaSoup на порту 3002 будет работать с теми же TURN серверами. Нужно только:
1. Остановить `peer-server.ts`
2. Запустить `mediasoup-server.ts` на том же порту 3002
3. Обновить клиентский код (уже сделано через feature flag)

## Прогресс

- [x] **Фаза 1:** MediaSoup сервер создан
- [x] **Фаза 2:** Клиентский хук mediasoup-client создан  
- [x] **Фаза 3:** Серверная запись (FFmpeg pipeline)
- [x] **Фаза 4:** Интеграция с video-call-provider
- [ ] **Фаза 5:** Тестирование и деплой

### Созданные файлы:

**Сервер:**
- `src/mediasoup-server.ts` - главный сервер MediaSoup (порт 3002)
- `src/lib/mediasoup/config.ts` - конфигурация (кодеки, порты, ICE)
- `src/lib/mediasoup/worker-manager.ts` - управление MediaSoup workers
- `src/lib/mediasoup/room.ts` - управление комнатами и участниками
- `src/lib/mediasoup/recorder.ts` - серверная запись через PlainTransport + FFmpeg

**Клиент:**
- `src/components/video-call/hooks/use-mediasoup-connection.ts` - хук для mediasoup-client
- `src/lib/mediasoup/client-types.ts` - типы для клиента

**Интеграция (Фаза 4):**
- `src/components/video-call/video-call-provider-mediasoup.tsx` - провайдер с MediaSoup
- `src/components/video-call/video-call-provider-wrapper.tsx` - обертка с feature flag
- Обновлен `src/components/video-call/views/connected-view.tsx` - индикатор записи

---

## Быстрый старт (порт 3002)

### Шаг 1: Установить зависимости на сервере

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y build-essential python3 python3-pip ffmpeg

# Открыть ОДИН порт для всех WebRTC соединений (благодаря WebRtcServer)
sudo ufw allow 13478/udp
sudo ufw allow 13478/tcp

# Порт 3002 (signaling) открывать НЕ нужно - nginx проксирует его
# Если без nginx - раскомментируйте: sudo ufw allow 3002/tcp
```

> **Важно:** Нужен только ОДИН порт (13478) для WebRTC media!
> Порт 3002 (signaling) идёт через nginx/HTTPS, открывать его в firewall не нужно.

### Шаг 2: Установить npm пакеты

```bash
pnpm add mediasoup mediasoup-client
```

### Шаг 3: Запустить MediaSoup сервер (порт 3002)

```bash
# Остановить PeerJS если запущен
# pkill -f peer-server

# Запустить MediaSoup на порту 3002
pnpm mediasoup

# Или с указанием публичного IP (для production)
MEDIASOUP_ANNOUNCED_IP=your.server.ip pnpm mediasoup
```

### Шаг 4: Включить MediaSoup на клиенте

```bash
# В .env.local
NEXT_PUBLIC_USE_MEDIASOUP=true
NEXT_PUBLIC_MEDIASOUP_URL=http://localhost:3002

# Для production
NEXT_PUBLIC_USE_MEDIASOUP=true  
NEXT_PUBLIC_MEDIASOUP_URL=https://your-domain.com:3002
```

### Шаг 5: Проверить что TURN работает

TURN серверы (`nice-sites.online`) уже настроены в `src/lib/video-call/config.ts` и автоматически используются MediaSoup.

---

### Как запустить MediaSoup сервер:

```bash
# В dev режиме
pnpm mediasoup

# Или с переменными окружения
MEDIASOUP_ANNOUNCED_IP=your.server.ip pnpm mediasoup
```

### Как включить MediaSoup на клиенте:

```bash
# В .env.local
NEXT_PUBLIC_USE_MEDIASOUP=true
NEXT_PUBLIC_MEDIASOUP_URL=http://localhost:3002

# Для production
NEXT_PUBLIC_USE_MEDIASOUP=true
NEXT_PUBLIC_MEDIASOUP_URL=https://mediasoup.your-domain.com
```

### Использование провайдера:

```tsx
// С автоматическим выбором (рекомендуется)
import { VideoCallProviderWrapper } from '@/components/video-call'

function App() {
  return (
    <VideoCallProviderWrapper>
      <YourApp />
    </VideoCallProviderWrapper>
  )
}

// Или напрямую MediaSoup провайдер
import { VideoCallProviderMediaSoup, useVideoCallMediaSoup } from '@/components/video-call'

function VideoCallUI() {
  const { 
    isServerRecording,
    startServerRecording,
    stopServerRecording,
    // ... остальные методы как в обычном провайдере
  } = useVideoCallMediaSoup()
  
  return (
    <div>
      {isServerRecording && <span>Идёт запись на сервере</span>}
      <button onClick={startServerRecording}>Начать запись</button>
      <button onClick={stopServerRecording}>Остановить запись</button>
    </div>
  )
}
```

---

## Почему MediaSoup?

### Сравнение PeerJS vs MediaSoup

| Критерий | PeerJS | MediaSoup |
|----------|--------|-----------|
| **Архитектура** | P2P (Mesh) | SFU (Selective Forwarding Unit) |
| **Медиа проходит через сервер** | Нет | Да |
| **Серверная запись** | Невозможно | Нативная поддержка |
| **Масштабируемость** | 2-4 участника | 100+ участников |
| **Качество записи** | Зависит от клиента | Контролируется сервером |
| **Надежность записи** | Теряется при обрыве | Сохраняется на сервере |
| **CPU нагрузка на сервер** | Минимальная | Средняя-высокая |
| **Сложность реализации** | Простая | Средняя-сложная |
| **Контроль над битрейтом** | Ограниченный | Полный (Simulcast/SVC) |

### Ключевые преимущества MediaSoup для телемедицины

1. **Гарантированная запись** - медиа проходит через сервер, запись не зависит от клиента
2. **Устойчивость к обрывам** - если пациент закрыл вкладку, запись уже на сервере
3. **Качество записи** - сервер выбирает лучший слой качества для записи
4. **Аудит** - полный контроль над тем, что записывается
5. **Масштабирование** - возможность добавить групповые консультации в будущем

---

## Текущая архитектура (PeerJS)

```
Пациент ◄────── P2P (WebRTC) ──────► Врач
                    │
             PeerJS Server (3002)
                    │
            Только сигналинг!
            Медиа идёт напрямую
            между браузерами
                    │
            Запись на клиенте
            (теряется при обрыве)
```

## Целевая архитектура (MediaSoup)

```
┌─────────────┐                              ┌─────────────┐
│   Пациент   │                              │    Врач     │
│  (Producer) │                              │  (Producer) │
└──────┬──────┘                              └──────┬──────┘
       │                                            │
       │  WebRTC Transport                          │  WebRTC Transport
       │  (аудио + видео)                           │  (аудио + видео)
       │                                            │
       ▼                                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     MediaSoup Server                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                      Router                              ││
│  │  ┌──────────────┐              ┌──────────────┐         ││
│  │  │  Producer    │              │  Producer    │         ││
│  │  │  (Пациент)   │              │  (Врач)      │         ││
│  │  └──────┬───────┘              └──────┬───────┘         ││
│  │         │                             │                  ││
│  │         ▼                             ▼                  ││
│  │  ┌──────────────┐              ┌──────────────┐         ││
│  │  │  Consumer    │◄────────────►│  Consumer    │         ││
│  │  │  (для врача) │              │(для пациента)│         ││
│  │  └──────────────┘              └──────────────┘         ││
│  │                                                          ││
│  │         │                             │                  ││
│  │         └──────────────┬──────────────┘                  ││
│  │                        ▼                                 ││
│  │              ┌──────────────────┐                        ││
│  │              │  PlainTransport  │                        ││
│  │              │  (RTP → FFmpeg)  │                        ││
│  │              └────────┬─────────┘                        ││
│  └───────────────────────┼──────────────────────────────────┘│
│                          ▼                                   │
│                 ┌──────────────────┐                         │
│                 │     FFmpeg       │                         │
│                 │  (серверная      │                         │
│                 │   запись)        │                         │
│                 └────────┬─────────���                         │
│                          ▼                                   │
│                 ┌──────────────────┐                         │
��                 │   recordings/    │                         │
│                 │   {appointmentId}│                         │
│                 │   .webm          │                         │
│                 └──────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Тре��ования к серверу

### Минимальные требования

| Ресурс | Минимум | Рекомендуется |
|--------|---------|---------------|
| **OS** | Ubuntu 20.04+ | Ubuntu 22.04 LTS |
| **CPU** | 2 ядра | 4+ ядра |
| **RAM** | 2 GB | 4+ GB |
| **Диск** | 20 GB SSD | 50+ GB SSD |
| **Сеть** | 100 Mbps | 1 Gbps |
| **Node.js** | 18+ | 20 LTS |
| **Python** | 3.6+ | 3.10+ |
| **GCC/G++** | 8+ | 11+ |
| **FFmpeg** | 4.0+ | 5.0+ |

### Необходимые порты (SINGLE PORT MODE)

| Порт | Протокол | Назначение |
|------|----------|------------|
| **3002** | TCP | MediaSoup Signaling API (Socket.IO) |
| **13478** | UDP + TCP | WebRTC Media (все транспорты через WebRtcServer) |
| **3478** | UDP/TCP | TURN Server (уже настроен на nice-sites.online) |
| **5349** | TCP | TURNS (TLS) (уже настроен на nice-sites.online) |

> **WebRtcServer:** Благодаря WebRtcServer все WebRTC соединения мультиплексируются на ОДИН порт (13478).
> Это значит неограниченное количество одновременных звонков на одном порту!
> 
> TURN серверы на `nice-sites.online` уже работают и не требуют изменений.

---

## Фазы реализации

### Фаза 1: Подготовка сервера (1-2 дня)
- [ ] Установка зависимостей на сервере (build-essential, python3, etc.)
- [ ] Установка FFmpeg
- [ ] Настройка портов и firewall
- [ ] Тестовая установка MediaSoup

**Команды для сервера:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y build-essential python3 python3-pip ffmpeg

# Установка Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Открытие портов (single port mode)
sudo ufw allow 3002/tcp   # Signaling
sudo ufw allow 13478/udp  # WebRTC media
sudo ufw allow 13478/tcp  # WebRTC media (TCP fallback)
```

---

### Фаза 2: MediaSoup сервер (3-4 дня) - ЗАВЕРШЕНО
- [x] Создание `src/lib/mediasoup/` директории
- [x] Установка `mediasoup` и `socket.io`
- [x] Создание Worker Manager (`worker-manager.ts`)
- [x] Создание Room Manager (`room.ts`)
- [x] API для создания WebRTC транспортов
- [x] API для Producer/Consumer
- [x] Главный сервер (`mediasoup-server.ts`)

**Структура сервера:**
```
mediasoup-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Точка входа
│   ├── config.ts             # Конфигурация MediaSoup
│   ├── mediasoup/
│   │   ├── worker.ts         # MediaSoup Worker
│   │   ├── router.ts         # Router для комнат
│   │   └── transport.ts      # WebRTC транспорты
│   ├── rooms/
│   │   ├── room-manager.ts   # Управление комнатами
│   │   └── room.ts           # Логика комнаты
│   ├── recording/
│   │   ├── recorder.ts       # FFmpeg интеграция
│   │   └── storage.ts        # Сохранение записей
│   └── signaling/
│       └── socket-handler.ts # Socket.IO события
└── recordings/               # Папка для записей
```

**Ключевые события Socket.IO:**
```typescript
// Клиент → Сервер
'joinRoom'              // Присоединиться к комнате
'createTransport'       // Создать WebRTC транспорт
'connectTransport'      // Подключить транспорт
'produce'               // Начать отправку медиа
'consume'               // Начать получение медиа
'startRecording'        // Начать запись
'stopRecording'         // Остановить запись

// Сервер → Клиент
'roomJoined'            // Успешное присоединение
'newProducer'           // Новый участник начал стриминг
'producerClosed'        // Участник закончил стриминг
'recordingStarted'      // Запись началась
'recordingStopped'      // Запись завершена
```

---

### Фаза 3: Клиентская часть (4-5 дней) - ЗАВЕРШЕНО
- [x] Установка `mediasoup-client`
- [x] Создание `use-mediasoup-connection.ts`
- [x] Создание типов `client-types.ts`
- [x] Добавлены методы записи в хук (`startRecording`, `stopRecording`)
- [x] Добавлены события записи (`recording-started`, `recording-stopped`)
- [ ] Адаптация `video-call-provider.tsx` (Фаза 5)
- [ ] Обновление UI компонентов (Фаза 5)
- [ ] Удаление PeerJS зависимостей (Фаза 6)

**Новые файлы:**
```
src/
├── lib/
│   └── mediasoup/
│       ├── client.ts         # MediaSoup клиент
│       ├── device.ts         # Device initialization
│       └── types.ts          # TypeScript типы
└── components/
    └── video-call/
        └── hooks/
            └── use-mediasoup-connection.ts  # Новый хук
```

**Основной флоу клиента:**
```typescript
// 1. Получить RTP capabilities от сервера
const rtpCapabilities = await socket.request('getRouterRtpCapabilities')

// 2. Создать Device
const device = new mediasoupClient.Device()
await device.load({ routerRtpCapabilities: rtpCapabilities })

// 3. Создать Send Transport
const sendTransport = await createSendTransport()

// 4. Создать Receive Transport
const recvTransport = await createRecvTransport()

// 5. Produce (отправить свой поток)
const videoProducer = await sendTransport.produce({ track: videoTrack })
const audioProducer = await sendTransport.produce({ track: audioTrack })

// 6. Consume (получить поток другого участника)
const consumer = await recvTransport.consume({ ... })
```

---

### Фаза 4: Серверная запись (3-4 дня) - ЗАВЕРШЕНО
- [x] Создание PlainTransport для RTP
- [x] Настройка FFmpeg pipeline
- [x] Запись обоих потоков в один файл
- [x] Сохранение метаданных (appointmentId, timestamps)
- [ ] Интеграция с Payload CMS (сохранение записи) - **в Фазе 5**

**Созданные модули записи:**

Файл: `src/lib/mediasoup/recorder.ts`

Функционал:
- `startRecording(roomId, router, producers)` - начать запись комнаты
- `stopRecording(sessionId)` - остановить запись
- `stopRecordingByRoom(roomId)` - остановить запись по ID комнаты
- `getActiveRecordingForRoom(roomId)` - получить активную запись комнаты
- PlainTransport для получения RTP потоков от producers
- Генерация SDP файла для FFmpeg
- Автоматическая остановка записи при выходе врача
- Автоматическая остановка при пустой комнате

**Socket события записи:**
```typescript
// Клиент → Сервер
'start-recording'       // Начать запись (только врач)
'stop-recording'        // Остановить запись (только врач)
'get-recording-status'  // Получить статус записи

// Сервер → Клиент
'recording-started'     // Запись началась
'recording-stopped'     // Запись завершена
```

**Конфигурация записи:** `src/lib/mediasoup/config.ts`
```typescript
export const recordingConfig = {
  outputDir: process.env.RECORDING_OUTPUT_DIR || '/tmp/mediasoup-recordings',
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  format: 'webm',
  videoCodec: 'libvpx-vp9',
  audioCodec: 'libopus',
}
```

**FFmpeg команда для записи:**
```bash
ffmpeg -protocol_whitelist file,rtp,udp \
  -i rtp://127.0.0.1:VIDEO_PORT \
  -i rtp://127.0.0.1:AUDIO_PORT \
  -c:v libvpx-vp9 -c:a libopus \
  -f webm recordings/{appointmentId}.webm
```

**Структура записи:**
```typescript
interface Recording {
  id: string
  appointmentId: string
  startedAt: Date
  endedAt: Date
  duration: number
  filePath: string
  fileSize: number
  participants: string[]
  status: 'recording' | 'processing' | 'ready' | 'failed'
}
```

---

### Фаза 5: Интеграция и тестирование (2-3 дня)
- [ ] Интеграция с существующей системой записей
- [ ] Тестирование различных сценариев обрыва
- [ ] Нагрузочное тестирование
- [ ] Тестирование на мобильных устройствах
- [ ] Документация

**Тестовые сценарии:**
1. Нормальный звонок с записью
2. Обрыв соединения пациента во время записи
3. Обрыв соединения врача во время записи
4. Потеря интернета на 10-30 секунд
5. Закрытие вкладки без завершения звонка
6. Одновременные звонки (нагрузка)

---

### Фаза 6: Деплой и миграция (1-2 дня)
- [ ] Деплой MediaSoup сервера
- [ ] Feature flag для постепенного перехода
- [ ] Мониторинг и логирование
- [ ] Откат на PeerJS если нужно

**Стратегия миграции:**
```typescript
// Feature flag
const USE_MEDIASOUP = process.env.NEXT_PUBLIC_USE_MEDIASOUP === 'true'

// В video-call-provider.tsx
const connectionHook = USE_MEDIASOUP 
  ? useMediasoupConnection 
  : usePeerConnection
```

---

## Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Сложность MediaSoup API | Средняя | Высокое | Поэтапная реализация, документация |
| Нагрузка на сервер | Средняя | Среднее | Мониторинг, масштабирование |
| Проблемы с NAT/Firewall | Низкая | Высокое | Настройка TURN, тестирование |
| Регрессии в звонках | Средняя | Высокое | Feature flag, A/B тестирование |

---

## Оценка времени

| Фаза | Оптимистично | Реалистично | Пессимистично |
|------|--------------|-------------|---------------|
| Фаза 1: Подготовка | 1 день | 2 дня | 3 дня |
| Фаза 2: Сервер | 3 дня | 4 дня | 6 дней |
| Фаза 3: Клиент | 4 дня | 5 дней | 7 дней |
| Фаза 4: Запись | 3 дня | 4 дня | 5 дней |
| Фаза 5: Тестирование | 2 дня | 3 дня | 4 дня |
| Фаза 6: Деплой | 1 день | 2 дня | 3 дня |
| **Итого** | **14 дней** | **20 дней** | **28 дней** |

---

## Чеклист готовности к миграции

- [ ] Сервер соответствует требованиям
- [ ] Порты открыты и доступны
- [ ] FFmpeg установлен и работает
- [ ] MediaSoup сервер запускается
- [ ] Тестовый звонок работает
- [ ] Запись сохраняется корректно
- [ ] Интеграция с Payload CMS работает
- [ ] Все тестовые сценарии пройдены
- [ ] Feature flag настроен
- [ ] Мониторинг настроен
- [ ] Rollback план готов

---

## Ссылки и ресурсы

- [MediaSoup Documentation](https://mediasoup.org/documentation/)
- [MediaSoup GitHub](https://github.com/versatica/mediasoup)
- [MediaSoup Demo](https://github.com/versatica/mediasoup-demo)
- [FFmpeg Recording Guide](https://trac.ffmpeg.org/wiki/Capture/Desktop)
