# Резюме изменений для исправления записи MediaSoup

## Проблема
Записи консультаций сохранялись на диск, но не появлялись в Payload CMS и на странице `/lk-org/consultation?id={}`.

## 3 новых файла добавлены

### 1. `/src/app/api/mediasoup-recording/finalize/route.ts` (NEW)
**Что делает:**
- Принимает запрос от клиента (врача) при остановке записи
- Читает файл записи из `/tmp/mediasoup-recordings/{sessionId}.webm`
- Загружает файл в коллекцию `Media` Payload
- Создает запись в коллекции `call-recordings`
- Удаляет временный файл

**Вызывается из:** `video-call-provider-mediasoup.tsx` в `onRecordingStopped`

### 2. `/src/app/api/mediasoup-recording/finalize-server/route.ts` (NEW)
**Что делает:**
- Принимает запрос от MediaSoup сервера при отключении врача
- Работает аналогично `/finalize`, но без JWT токена врача
- Использует `MEDIASOUP_SERVER_SECRET` для аутентификации
- Получает `doctorId` из `appointment` в Payload

**Вызывается из:** `mediasoup-server.ts` в disconnect handler и при пустой комнате

### 3. `/MEDIASOUP_RECORDING_FIX.md` (NEW)
Подробная документация по проблеме и решению.

## Файлы изменены

### 1. `/src/components/video-call/video-call-provider-mediasoup.tsx`
**Строки изменены:**
- Добавлены refs:
  - `recordingStartTimeRef` - сохраняет время начала записи
  - `isAudioOnlyRef` - сохраняет тип записи

- Обновлен `onRecordingStarted`:
  - Теперь сохраняет `Date.now()` в `recordingStartTimeRef`

- **Полностью переписан `onRecordingStopped`:**
  - Теперь вызывает API `/api/mediasoup-recording/finalize`
  - Передает `appointmentId`, `doctorId`, `sessionId`, `durationSeconds`
  - Показывает тост об успехе/ошибке

- Обновлен `handleCallEnded`:
  - Врач перед выходом из комнаты останавливает запись (если она активна)
  - Ждет 500ms чтобы дать время на финализацию

- Добавлен useEffect для синхронизации `isAudioOnlyRef`

### 2. `/src/mediasoup-server.ts`
**Места изменений:**

1. **В disconnect handler (строка ~630):**
   - После остановки записи вызывает API `/api/mediasoup-recording/finalize-server`
   - Передает `appointmentId` (парсится из `roomId` как "appointment_123")
   - Вычисляет `durationSeconds` из `session.startedAt`
   - Передает `MEDIASOUP_SERVER_SECRET`

2. **В empty room handler (строка ~688):**
   - Аналогично финализирует оставшуюся запись
   - Обрабатывает ошибки gracefully

## Переменные окружения, которые нужны

Добавьте в `.env`:
```env
NEXTJS_URL=http://localhost:3000
MEDIASOUP_SERVER_SECRET=your-secret-key
RECORDING_OUTPUT_DIR=/tmp/mediasoup-recordings
```

## Процесс работы (новый)

1. **Врач нажимает "Начать запись"**
   - MediaSoup начинает запись в `/tmp/mediasoup-recordings/{sessionId}.webm`
   - Клиент сохраняет текущее время в `recordingStartTimeRef`

2. **Врач нажимает "Остановить запись"**
   - `mediasoup.stopRecording()` отправляет сигнал серверу
   - Сервер эмитит `recording-stopped` событие
   - `onRecordingStopped` вызывает `/api/mediasoup-recording/finalize`
   - API загружает файл в Payload и создает `CallRecording`

3. **Врач отключается без явной остановки**
   - Сервер получает `disconnect` событие
   - Сервер останавливает запись
   - Сервер вызывает `/api/mediasoup-recording/finalize-server`
   - API загружает файл в Payload и создает `CallRecording`

4. **Результат:**
   - Запись видна на `/lk-org/consultation?id={appointmentId}`
   - Файл удален из `/tmp`

## Что проверить

### 1. Переменные окружения
```bash
echo $NEXTJS_URL
echo $MEDIASOUP_SERVER_SECRET
echo $RECORDING_OUTPUT_DIR
```

### 2. Логи
Ищите в консоли:
- `[MediaSoup Provider] Recording stopped`
- `[MediaSoup Provider] Finalizing recording`
- `[MediaSoup] Finalizing recording for appointment`

### 3. Базу данных
Проверьте коллекцию `call-recordings` в Payload CMS:
```sql
SELECT * FROM call_recordings ORDER BY created_at DESC LIMIT 5;
```

## Backward compatibility
- Старые записи остаются в файловой системе
- Новые записи создаются в Payload CMS
- Все изменения только добавляют функциональность, не ломают существующее

## Возможные ошибки и решения

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `Recording file not found` | Файл не найден в `/tmp` | Проверьте `RECORDING_OUTPUT_DIR` |
| `Unauthorized` (finalize) | Нет JWT токена врача | Проверьте cookies |
| `Unauthorized` (finalize-server) | Неправильный `serverSecret` | Проверьте `MEDIASOUP_SERVER_SECRET` |
| `Appointment not found` | `appointmentId` некорректен | Проверьте `roomId` в MediaSoup |
| `Recording file is empty` | Запись ничего не записала | Может быть проблема с микрофоном/видео |

## Дополнительные замечания

- ⚠️ Убедитесь что `/tmp/mediasoup-recordings` существует и имеет правильные права
- ⚠️ Значение `MEDIASOUP_SERVER_SECRET` по умолчанию небезопасно, используйте сильный пароль в продакшене
- ⚠️ `NEXTJS_URL` должен быть доступен из машины, где запущен MediaSoup сервер (может быть `http://localhost:3000` для локальной разработки)
