/**
 * Next.js instrumentation hook.
 *
 * Runs once per server process, before any request is handled.
 *
 * Purpose: catch the errors that normally kill the request WITHOUT printing
 * anything useful into `pm2 logs`. An unhandled promise rejection (for example
 * `revalidateTag()` throwing inside a Payload hook) aborts the in-flight HTTP
 * request, so the browser only sees a bare `TypeError: Failed to fetch` while
 * the server log stays completely empty.
 *
 * Everything is written to stderr, which pm2 captures into its error log.
 */
export function register() {
  // Only run in the Node.js runtime (not edge, not the browser).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Guard against double registration during dev hot reload.
  //
  // Два ОТДЕЛЬНЫХ флага намеренно. Раньше был один (`__v0ErrorHooksInstalled`),
  // и защита sweeper'а от повторного запуска работала лишь как побочный эффект
  // раннего `return`: достаточно переставить блоки местами, чтобы получить
  // два таймера в одном процессе.
  const g = globalThis as typeof globalThis & {
    __v0ErrorHooksInstalled?: boolean
    __v0HoldsSweeperStarted?: boolean
  }

  const installErrorHooks = !g.__v0ErrorHooksInstalled
  const startSweeper =
    !g.__v0HoldsSweeperStarted &&
    // Пропускаем во время `next build`: сборка запускает этот файл, но таймер
    // там не нужен (и лезть в БД на этапе билда нельзя).
    process.env.NEXT_PHASE !== 'phase-production-build'

  if (!installErrorHooks && !startSweeper) return

  const describe = (err: unknown) => {
    if (err instanceof Error) {
      return {
        name: err.name,
        message: err.message,
        stack: err.stack,
        cause: err.cause ? String(err.cause) : undefined,
      }
    }
    try {
      return { value: JSON.parse(JSON.stringify(err)) }
    } catch {
      return { value: String(err) }
    }
  }

  const report = (kind: string, err: unknown) => {
    console.error(
      `\n[v0][${kind}] ${new Date().toISOString()} pid=${process.pid}\n` +
        JSON.stringify(describe(err), null, 2) +
        '\n',
    )
  }

  if (installErrorHooks) {
    g.__v0ErrorHooksInstalled = true

    process.on('unhandledRejection', (reason) => {
      report('unhandledRejection', reason)
    })

    process.on('uncaughtException', (err) => {
      report('uncaughtException', err)
    })

    console.log(`[v0][instrumentation] error hooks installed (pid ${process.pid})`)
  }

  // Фоновое освобождение просроченных броней: единственный планировщик sweep'а.
  // Страницы (/doctor/[id], /lk) его больше не вызывают.
  let stopSweeper: (() => void) | undefined

  if (startSweeper) {
    g.__v0HoldsSweeperStarted = true

    // Динамический импорт: Payload тянет за собой конфиг и адаптер БД, и держать
    // это в статическом графе instrumentation мешает сборке.
    import('@/lib/server/appointment-holds')
      .then(({ startExpiredHoldsSweeper }) => {
        stopSweeper = startExpiredHoldsSweeper()
        console.log(`[v0][instrumentation] holds sweeper started (pid ${process.pid})`)
      })
      .catch((err) => {
        g.__v0HoldsSweeperStarted = false
        report('holdsSweeperStartFailed', err)
      })
  }

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      console.error(`[v0][signal] received ${signal}, pid ${process.pid}`)
      // Останавливаем таймер, чтобы при `pm2 restart` не начинать новый проход
      // в уже завершающемся процессе.
      stopSweeper?.()
    })
  }
}
