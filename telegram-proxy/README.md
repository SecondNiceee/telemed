# Прокси к Telegram Bot API

Хостинг основного приложения не имеет доступа к `api.telegram.org`. Эта функция
на Vercel принимает запросы Bot API от сокет-сервера и пробрасывает их в Telegram.

Через неё проходит только текст вопросов и ответов чата поддержки. Чат анонимный —
имён и контактов посетителей в нём нет, поэтому персональные данные за границу
не уходят.

## Деплой

1. Vercel → **Add New Project** → выбрать репозиторий `telemed`.
2. **Root Directory** → `telegram-proxy`. Framework Preset — `Other`.
3. **Environment Variables** → `PROXY_SECRET` = длинная случайная строка
   (`openssl rand -hex 32`).
4. Deploy. Адрес вида `https://telemed-telegram-proxy.vercel.app`.

## Настройка основного приложения

В окружении сокет-сервера (`docker-compose` / `.env` на хостинге):

```
TELEGRAM_API_BASE=https://telemed-telegram-proxy.vercel.app
TELEGRAM_PROXY_SECRET=<тот же PROXY_SECRET>
TELEGRAM_POLL_TIMEOUT_SECONDS=40
```

`TELEGRAM_POLL_TIMEOUT_SECONDS` обязательно уменьшить: функция живёт не дольше
60 секунд (`maxDuration` в `vercel.json`), а Telegram по умолчанию держит
`getUpdates` открытым 50 секунд плюс сеть — впритык. 40 секунд оставляют запас.

## Проверка

```
curl -X POST https://<адрес>/bot<TOKEN>/getMe \
  -H 'x-telegram-proxy-secret: <PROXY_SECRET>'
```

Должен вернуться `{"ok":true,"result":{...}}` с данными бота. Без заголовка —
`401`, с чужим путём — `404`.

## Если не работает

- `404 NOT_FOUND` от Vercel (текстом, не JSON) на `/bot.../getMe` — не применился
  rewrite из `vercel.json`. Проверить, что Root Directory проекта = `telegram-proxy`.
- `500 FUNCTION_INVOCATION_FAILED` — смотреть логи функции в Vercel; чаще всего
  не задан `PROXY_SECRET`.
- `401 Unauthorized` в JSON от Telegram — прокси работает, неверный токен бота.
  Токен всегда вида `1234567890:AA...` (цифры, двоеточие, 35 символов).
