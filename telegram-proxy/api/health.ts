/**
 * Проверка, что функции прокси вообще задеплоились.
 *
 * `GET /api/health` → 200 с признаком, задан ли PROXY_SECRET (сам секрет не
 * раскрывается). Если вместо JSON приходит текстовый 404 от Vercel — значит
 * папка `api/` не собралась: неверный Root Directory или Framework Preset.
 */
export function GET(): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      service: 'telemed-telegram-proxy',
      secretConfigured: Boolean(process.env.PROXY_SECRET),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  )
}
