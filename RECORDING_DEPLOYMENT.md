# Инструкция развертывания исправления записи MediaSoup

## Шаг 1: Обновить переменные окружения

### Локально (development)
Добавьте в `.env`:
```env
# Если не установлены - используются defaults
NEXTJS_URL=http://localhost:3000
MEDIASOUP_SERVER_SECRET=dev-secret-key-12345
RECORDING_OUTPUT_DIR=/tmp/mediasoup-recordings
```

### На сервере (production)
```env
# Обязательно используйте реальные значения!
NEXTJS_URL=https://your-domain.com
MEDIASOUP_SERVER_SECRET=<generate-strong-random-key>
RECORDING_OUTPUT_DIR=/var/mediasoup-recordings
```

**Как сгенерировать сильный ключ:**
```bash
# На Linux/Mac
openssl rand -hex 32

# На Windows PowerShell
[guid]::NewGuid().ToString()
```

## Шаг 2: Убедиться в директории для записей

### Linux/Mac
```bash
mkdir -p /tmp/mediasoup-recordings
# или для production
mkdir -p /var/mediasoup-recordings
chmod 755 /var/mediasoup-recordings
```

### Windows
```powershell
New-Item -ItemType Directory -Path "C:\mediasoup-recordings" -Force
```

## Шаг 3: Проверить коллекции Payload

Убедитесь что в `src/collections/` существуют:
- ✅ `CallRecordings.ts` - коллекция для записей
- ✅ `Media.ts` - коллекция для файлов видео/аудио

```bash
ls -la src/collections/ | grep -i recording
ls -la src/collections/ | grep -i media
```

## Шаг 4: Развернуть (Development)

```bash
# 1. Установить зависимости
pnpm install

# 2. В первом терминале - Next.js dev сервер
pnpm run dev

# 3. Во втором терминале - MediaSoup сервер
pnpm run mediasoup

# 4. В третьем терминале - Socket.io сервер (если используется)
pnpm run socket
```

## Шаг 5: Развернуть (Production)

### На Vercel
1. Добавить переменные окружения в Settings → Environment Variables:
   ```
   NEXTJS_URL = https://your-domain.com
   MEDIASOUP_SERVER_SECRET = <strong-random-key>
   RECORDING_OUTPUT_DIR = /tmp/mediasoup-recordings
   ```

2. Убедиться что Next.js сервер доступен по HTTPS

3. MediaSoup сервер должен быть запущен **отдельно** (не на Vercel):
   ```bash
   # На отдельном сервере
   export NEXTJS_URL=https://your-domain.com
   export MEDIASOUP_SERVER_SECRET=<same-key-as-above>
   pnpm run mediasoup
   ```

### На собственном сервере
```bash
# 1. Build
pnpm run build

# 2. Запустить Next.js
NODE_OPTIONS="--max-old-space-size=8192" pnpm start &

# 3. Запустить MediaSoup (в другом процессе/терминале)
pnpm run mediasoup &

# 4. Запустить Socket.io (если нужен)
pnpm run socket &
```

## Тестирование

### Локально

1. **Стартовать dev окружение (Шаг 4)**

2. **Открыть браузер:**
   ```
   http://localhost:3000
   ```

3. **Создать консультацию:**
   - Логиниться как врач
   - Открыть /lk-med/chat или /lk/chat
   - Нажать "Начать звонок"

4. **Тестировать запись:**
   - Нажать "Начать запись"
   - Разговаривать ~30 сек
   - Нажать "Остановить запись"

5. **Проверить результат:**
   - Откройте `/lk-org/consultation?id={appointmentId}`
   - Запись должна быть видна в списке

6. **Проверить файлы:**
   ```bash
   # Должен быть пуст или содержать очень мало файлов
   ls -la /tmp/mediasoup-recordings/
   
   # В Payload должна быть запись:
   # Collections → call-recordings → должна быть новая запись
   ```

### Что должно быть в консоли браузера

```
[MediaSoup Provider] Recording started: session-123 by doctor-456
[MediaSoup Provider] Recording stopped: session-123 /tmp/mediasoup-recordings/session-123.webm
[MediaSoup Provider] Finalizing recording... {...}
[MediaSoup Provider] Recording finalized: {"success":true,"recordingId":789}
```

### Что должно быть в консоли sервера

```
[MediaSoup] Recording started for room: appointment_123
[MediaSoup Provider] Recording stopped
[MediaSoupRecording/Finalize] Starting finalization
[MediaSoupRecording/Finalize] Recording file found, size: 1234567
[MediaSoupRecording/Finalize] Media uploaded, ID: 456
[MediaSoupRecording/Finalize] CallRecording created, ID: 789
```

## Отладка проблем

### Проблема: "Recording file not found"

```bash
# Проверить содержимое директории
ls -la /tmp/mediasoup-recordings/
du -sh /tmp/mediasoup-recordings/

# Проверить права доступа
stat /tmp/mediasoup-recordings/

# Проверить где ищет файл
grep "RECORDING_OUTPUT_DIR" src/lib/mediasoup/config.ts
```

### Проблема: "Unauthorized - invalid token"

```javascript
// В браузере консоли
document.cookie  // проверить что есть doctors-token
```

### Проблема: MediaSoup не может достучаться до Next.js

```bash
# На машине где MediaSoup:
curl -X POST http://localhost:3000/api/mediasoup-recording/finalize-server \
  -H "Content-Type: application/json" \
  -d '{"appointmentId":1,"sessionId":"test","serverSecret":"..."}'

# Должно быть: {"error":"Missing required fields..."} или {"error":"Appointment not found"}
# Не должно быть: "Connection refused" или "Cannot GET"
```

### Проблема: Файл есть, но Payload отказывается загружать

```javascript
// Проверить размер файла
const fs = require('fs');
const size = fs.statSync('/tmp/mediasoup-recordings/session.webm').size;
console.log('Size:', size); // должно быть > 0

// Проверить что Media коллекция имеет правильные настройки
// src/collections/Media.ts
```

## Мониторинг

### Проверить что все работает

```bash
# 1. Проверить процессы
ps aux | grep -E "next|mediasoup|socket" | grep -v grep

# 2. Проверить порты
netstat -tlnp | grep -E "3000|3001|3002"

# 3. Проверить логи
tail -f /var/log/mediasoup.log  # если настроено

# 4. Проверить БД
# SELECT COUNT(*) FROM call_recordings WHERE created_at > NOW() - interval '1 hour';
```

### Настроить Cron job для очистки старых файлов

```bash
# /etc/cron.daily/cleanup-mediasoup-recordings
#!/bin/bash
find /var/mediasoup-recordings -name "*.webm" -mtime +1 -delete
find /var/mediasoup-recordings -name "*.sdp" -mtime +1 -delete
```

## Откат

Если что-то пошло не так:

1. **Остановить сервис:**
   ```bash
   pkill -f "pnpm run mediasoup"
   pkill -f "next dev"
   ```

2. **Откатить код:**
   ```bash
   git revert <commit-hash>
   # или
   git reset --hard HEAD~1
   ```

3. **Очистить временные файлы:**
   ```bash
   rm -f /tmp/mediasoup-recordings/*.webm
   rm -f /tmp/mediasoup-recordings/*.sdp
   ```

4. **Перезагрузить:**
   ```bash
   pnpm install
   pnpm run dev
   pnpm run mediasoup
   ```

## Чек-лист перед production

- [ ] Переменные окружения установлены
- [ ] Директория `/var/mediasoup-recordings` существует и имеет правильные права
- [ ] HTTPS включен на Next.js сервере
- [ ] MEDIASOUP_SERVER_SECRET - сильный пароль (не default)
- [ ] Payload CMS доступен (проверить /admin)
- [ ] MediaSoup сервер может достичь Next.js (проверить curl)
- [ ] Проведено локальное тестирование
- [ ] Есть резервная копия БД
- [ ] Мониторинг настроен (логи, процессы, диск)
- [ ] Есть инструкция по откату
- [ ] Команда проинформирована об изменениях

## Дополнительная информация

- Подробное описание: `MEDIASOUP_RECORDING_FIX.md`
- Резюме изменений: `RECORDING_CHANGES_SUMMARY.md`
- Миграция с PeerJS: `MediaSoupMigration.md`
