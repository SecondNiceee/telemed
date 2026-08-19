# Перенос звонков replixo → telemed

## Что перенесено

В telemed используется отдельная MediaSoup SFU-комната для каждой консультации: `roomId = appointment_<id>`. Перенесены аудио, видео, демонстрация экрана, повторное подключение Socket.IO, ICE restart, защита от потери сети и устойчивый захват микрофона. Чат, whiteboard, презентации, аннотации и запись из replixo не входят в текущий runtime.

## Переменные окружения

### Next.js

- `MEDIASOUP_SERVER_SECRET` — общий секрет не короче 32 символов для короткоживущих room token.
- `NEXT_PUBLIC_MEDIASOUP_URL` — публичный origin signaling-сервера, например `https://call.example.com`.
- `NEXT_PUBLIC_MEDIASOUP_PATH` — Socket.IO path, по умолчанию `/socket.io`, за nginx обычно `/mediasoup/socket.io`.

### MediaSoup

- `MEDIASOUP_PORT=3002`
- `MEDIASOUP_LISTEN_IP=0.0.0.0`
- `MEDIASOUP_ANNOUNCED_IP` — публичный IP SFU.
- `MEDIASOUP_RTC_MIN_PORT=40000`
- `MEDIASOUP_RTC_MAX_PORT=49999`
- `MEDIASOUP_NUM_WORKERS` — обычно число CPU.
- `MEDIASOUP_CORS_ORIGINS` — разрешённые origins через запятую.
- `MEDIASOUP_SOCKET_PATH=/socket.io`

Секрет должен совпадать у Next.js и SFU. Не публикуйте его в переменной `NEXT_PUBLIC_*`.

## Локальный запуск

```bash
pnpm dev
pnpm socket
pnpm mediasoup
```

Next.js выдаёт token через `POST /api/mediasoup/token`, проверяя Payload-сессию и принадлежность appointment. Чат-сокет на порту 3001 отвечает только за invite/accept/reject; вся медиа-сигнализация идёт на MediaSoup.

## Клиент и UI

Комната доступна по `/appointment/[id]/call`; для аудио-only используется `?audio=1`. Клиент получает token, подключается к `appointment_<id>`, создаёт один send и один recv transport, публикует mic/camera/screen producers и потребляет producers второго участника. При refresh или reconnect stale peer заменяется, а пустая комната сохраняется 30 секунд перед закрытием.

## Production и nginx

Запускайте Next.js, chat socket и MediaSoup как три независимых процесса под systemd/PM2/container supervisor. TLS завершается на nginx; signaling обязан работать по WSS.

```nginx
location /mediasoup/socket.io/ {
  proxy_pass http://127.0.0.1:3002/socket.io/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_read_timeout 75s;
}

location /mediasoup/health {
  proxy_pass http://127.0.0.1:3002/health;
}
```

Откройте на firewall диапазон `40000:49999` по UDP и TCP. `MEDIASOUP_ANNOUNCED_IP` должен указывать на доступный клиентам публичный IP; внутренний адрес контейнера использовать нельзя. HTTP health endpoint не заменяет проверку RTC-портов.

## Диагностика

1. `/health` должен возвращать `status: ok`.
2. В DevTools проверьте успешный `/api/mediasoup/token` и WSS upgrade.
3. Если signaling работает, но видео отсутствует, проверьте announced IP, NAT и UDP/TCP range.
4. При `Appointment access denied` проверьте session cookie и связи `appointment.user`/`appointment.doctor`.
5. При reconnect убедитесь, что повторный join использует тот же `peerId`, а старые transports закрываются.

## Тест-план врач ↔ пациент

1. Войти в двух профилях и открыть один appointment.
2. Врач нажимает «Звонок»; пациент видит приглашение и принимает его.
3. Оба попадают в `/appointment/<id>/call`, слышат и видят друг друга.
4. Проверить mute/unmute без повторного запроса разрешения, camera on/off и screen share.
5. Кратко отключить сеть, включить её и проверить reconnect/ICE restart.
6. Обновить вкладку одного участника и убедиться, что clone peer не остаётся.
7. Закрыть вкладку, вернуться в течение 30 секунд и повторно войти.
8. Проверить reject, leave и запрет входа пользователя, не связанного с appointment.
9. Повторить в мобильном viewport и в браузере без камеры.

Запись отложена: существующие `recorder.ts`, Payload `CallRecordings` и API финализации сохранены, но не подключены к комнате и UI.
