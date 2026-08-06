# Переход с MediaSoup на PeerJS

> Время: ~2 минуты

---

## Шаг 1: Остановить MediaSoup сервер

```bash
# Найти и остановить процесс MediaSoup
pkill -f mediasoup-server

# Или если используете PM2
pm2 stop mediasoup-server
```

---

## Шаг 2: Настроить переменные окружения

```bash
# В .env или .env.local изменить:

# Выключить MediaSoup (вернуться на PeerJS)
NEXT_PUBLIC_USE_MEDIASOUP=false

# Или просто удалить эту переменную
# unset NEXT_PUBLIC_USE_MEDIASOUP
```

---

## Шаг 3: Запустить PeerJS сервер

```bash
# Development
pnpm peer

# Production (с PM2)
pm2 start "pnpm peer" --name peer-server
```

---

## Шаг 4: Перезапустить Next.js

```bash
# Чтобы применить новые переменные окружения
pnpm dev

# Или для production
pm2 restart nextjs-app
```

---

## Проверка

1. Откройте консоль браузера
2. Должно быть сообщение: `[PeerJS] Connected to server`
3. При звонке соединение должно быть P2P (peer-to-peer)

---

## Порты

| Порт | Протокол | Назначение |
|------|----------|------------|
| 3002 | TCP | PeerJS signaling server |
| 3478 | UDP/TCP | TURN server (nice-sites.online) |
| 5349 | TCP | TURNS server (nice-sites.online) |

---

## Преимущества PeerJS

- Проще в настройке
- Меньше нагрузка на сервер (P2P)
- Не требует компиляции нативных модулей

## Недостатки PeerJS

- Запись только на клиенте (ненадежно)
- Хуже работает за строгими NAT

---

## Вернуться на MediaSoup

См. [TURN_ON_MEDIASOUP.md](./TURN_ON_MEDIASOUP.md)
