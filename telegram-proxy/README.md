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

Сначала открыть в браузере `https://<адрес>/api/health`.

- Пришёл JSON `{"ok":true,...}` — функции задеплоены. Если там
  `"secretConfigured":false` — добавить `PROXY_SECRET` в Environment Variables
  и сделать Redeploy (переменные применяются только к новым деплоям).
- Пришёл текстовый `404 NOT_FOUND` от Vercel — папка `api/` не собралась.
  Открыть Settings → General и проверить: **Root Directory = `telegram-proxy`**,
  **Framework Preset = Other**, Build Command и Output Directory пустые.
  Пресет Next.js тут частая ошибка: Vercel угадывает его по корню репозитория
  и потом пытается собрать несуществующее Next-приложение.
- `404 NOT_FOUND` только на `/bot.../getMe`, а `/api/health` работает —
  не применился rewrite из `vercel.json`; убедиться, что задеплоен свежий коммит.
- В логах сокет-сервера `Unexpected token 'T', "The page c"...` — это тот же
  текстовый 404 от Vercel, пришедший вместо JSON. Смотреть пункты выше.
- `500 FUNCTION_INVOCATION_FAILED` — смотреть логи функции в Vercel; чаще всего
  не задан `PROXY_SECRET`.
- `401 Unauthorized` в JSON от Telegram — прокси работает, неверный токен бота.
  Токен всегда вида `1234567890:AA...` (цифры, двоеточие, 35 символов).
