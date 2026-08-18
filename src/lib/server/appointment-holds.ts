import 'server-only'

import { getPayload } from 'payload'
import config from '@payload-config'
import type { DoctorScheduleDate } from '@/lib/api/types'
import { filterFutureSchedule } from '@/lib/schedule-time'

type PayloadInstance = Awaited<ReturnType<typeof getPayload>>

async function getPayloadInstance(): Promise<PayloadInstance> {
  return getPayload({ config })
}

/** Извлечь числовой id из relationship-поля Payload. */
function toId(raw: unknown): number {
  return typeof raw === 'object' && raw !== null ? (raw as { id: number }).id : Number(raw)
}

/** Слот в расписании врача. */
type SlotRef = { date: string; time: string }

/**
 * Вернуть сразу несколько слотов в расписание одного врача.
 *
 * Расписание хранится одним JSON-полем, поэтому запись — это read-modify-write
 * всей строки doctors. Пачку слотов одного врача обязательно применять одним
 * update: N последовательных апдейтов одной и той же строки не только медленнее,
 * но и теряют изменения при параллельных sweep'ах.
 *
 * При создании записи слот удаляется из schedule (а пустой день вычищается целиком),
 * поэтому при отмене неоплаченной брони нужно не просто восстановить время,
 * но и при необходимости заново создать день.
 */
export async function restoreDoctorSlots({
  payload,
  doctorId,
  slots,
  req,
}: {
  payload: PayloadInstance
  doctorId: number
  slots: SlotRef[]
  /** Транзакция вызывающего (releaseHold), чтобы отмена брони и возврат слота были атомарны. */
  req?: { transactionID?: string | number }
}): Promise<void> {
  if (slots.length === 0) return

  const doctor = await payload.findByID({
    collection: 'doctors',
    id: doctorId,
    depth: 0,
    overrideAccess: true,
    req,
  })

  if (!doctor) return

  const schedule = (doctor.schedule || []) as DoctorScheduleDate[]

  // Копия расписания, проиндексированная по дате: собираем все слоты пачки
  // в памяти и только потом пишем один раз.
  const byDate = new Map<string, DoctorScheduleDate>()
  for (const day of schedule) {
    byDate.set(day.date, { ...day, slots: [...(day.slots || [])] })
  }

  let changed = false

  for (const { date, time } of slots) {
    const day = byDate.get(date)

    if (!day) {
      // День был удалён целиком (в нём не осталось слотов) — создаём заново.
      byDate.set(date, { date, slots: [{ time }] })
      changed = true
      continue
    }

    // Идемпотентность: если слот уже на месте, ничего не дублируем.
    if ((day.slots || []).some((slot) => slot.time === time)) continue

    day.slots = [...(day.slots || []), { time }]
    changed = true
  }

  if (!changed) return

  const updatedSchedule = [...byDate.values()]
    .map((day) => ({
      ...day,
      slots: [...(day.slots || [])].sort((a, b) => a.time.localeCompare(b.time)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  await payload.update({
    collection: 'doctors',
    id: doctorId,
    data: { schedule: updatedSchedule },
    overrideAccess: true,
    req,
  })
}

/** Вернуть один слот в расписание врача. */
export async function restoreDoctorSlot({
  payload,
  doctorId,
  date,
  time,
  req,
}: {
  payload: PayloadInstance
  doctorId: number
  date: string
  time: string
  req?: { transactionID?: string | number }
}): Promise<void> {
  await restoreDoctorSlots({ payload, doctorId, slots: [{ date, time }], req })
}

/** Платёж по этой брони уже оплачен и деньги ещё не возвращены. */
function hasSettledPayment(appointment: { payment?: { status?: string | null } | null }): boolean {
  return appointment.payment?.status === 'succeeded'
}

/**
 * Отменить неоплаченную бронь и вернуть слот врачу.
 * Возвращает false, если запись уже не в статусе «Ожидает оплаты».
 */
export async function releaseHold({
  payload,
  appointmentId,
}: {
  payload: PayloadInstance
  appointmentId: number
}): Promise<boolean> {
  const appointment = await payload.findByID({
    collection: 'appointments',
    id: appointmentId,
    overrideAccess: true,
  })

  if (!appointment || appointment.status !== 'pending_payment') return false

  // Деньги за эту бронь уже получены, но исход ещё не доведён до конца
  // (идёт возврат или подтверждение). Отменять её здесь нельзя: пациент
  // остался бы без записи и без возврата. Доводит процесс до конца
  // `applyPaymentOutcome` в lib/server/appointment-payments.ts — он сам
  // отменит бронь после успешного возврата (статус станет 'refunded').
  if (hasSettledPayment(appointment as { payment?: { status?: string | null } | null })) {
    console.warn('[v0][holds] бронь оплачена — отмену выполняет платёжный слой', {
      appointmentId,
    })
    return false
  }

  // Отмена брони и возврат слота — одна транзакция.
  //
  // Без неё падение между двумя шагами теряет слот навсегда: запись уже
  // 'cancelled', а время в расписание не вернулось. Фоновый sweep такое не
  // подберёт — он ищет только 'pending_payment'.
  //
  // Оба вызова идут с одним transactionID, то есть в одном соединении и
  // последовательно. Это не тот случай, что описан в afterChange у create:
  // там дедлок возникал из-за апдейта doctors ДРУГИМ соединением, пока
  // транзакция appointments держала блокировку.
  const transactionID = (await payload.db.beginTransaction()) ?? undefined
  const req = transactionID !== undefined ? { transactionID } : undefined

  try {
    await payload.update({
      collection: 'appointments',
      id: appointmentId,
      data: { status: 'cancelled' },
      overrideAccess: true,
      req,
    })

    await restoreDoctorSlot({
      payload,
      doctorId: toId(appointment.doctor),
      date: appointment.date,
      time: appointment.time,
      req,
    })

    if (transactionID !== undefined) await payload.db.commitTransaction(transactionID)
  } catch (err) {
    if (transactionID !== undefined) await payload.db.rollbackTransaction(transactionID)
    throw err
  }

  return true
}

/**
 * Минимальный интервал между sweep'ами с одинаковым скоупом.
 *
 * Защита от пачки одновременных вызовов с одним и тем же скоупом.
 *
 * ВАЖНО: из-за троттла `releaseExpiredHolds()` возвращает 0 в двух разных
 * случаях — «освобождать было нечего» и «проход пропущен». Поэтому по нулю
 * НЕЛЬЗЯ судить о состоянии расписания (ровно на этом раньше ошибалась
 * страница врача, отдавая расписание из кеш��).
 */
const SWEEP_THROTTLE_MS = 10_000

/** Время последнего завершённого sweep'а по скоупу. */
const lastSweepAt = new Map<string, number>()

/** Sweep'ы, выполняющиеся прямо сейчас — чтобы не дублировать работу. */
const inFlightSweeps = new Map<string, Promise<number>>()

/**
 * Максимум броней за один проход адресного (не фонового) sweep'а.
 *
 * Лимит нужен, чтобы вызывающий не ждал разбора всех накопившихся просрочек.
 * Остаток разберёт фоновый sweeper.
 */
const SWEEP_MAX_BATCH = 100

/**
 * Максимум броней за один проход фонового sweep'а.
 *
 * Фоновый проход никого не заставляет ждать (он не внутри рендера), поэтому
 * лимит здесь выше — накопившиеся просрочки разбираются за меньшее число проходов.
 */
const BACKGROUND_SWEEP_MAX_BATCH = 1000

type SweepScope = { doctorId?: number; userId?: number }

type SweepOptions = SweepScope & { maxBatch?: number }

async function runSweep({
  doctorId,
  userId,
  maxBatch = SWEEP_MAX_BATCH,
}: SweepOptions): Promise<number> {
  const payload = await getPayloadInstance()

  const expired = await payload.find({
    collection: 'appointments',
    where: {
      status: { equals: 'pending_payment' },
      paymentExpiresAt: { less_than: new Date().toISOString() },
      ...(doctorId ? { doctor: { equals: doctorId } } : {}),
      ...(userId ? { user: { equals: userId } } : {}),
    },
    // pagination: false убирает второй запрос (SELECT COUNT), который Payload
    // делает только чтобы посчитать totalDocs — он здесь не нужен.
    pagination: false,
    limit: maxBatch,
    // Тянем ровно то, что нужно для восстановления слота, — без повторного
    // findByID на каждую бронь. `payment` нужен, чтобы не отменить бронь,
    // деньги за которую уже получены.
    select: { doctor: true, date: true, time: true, payment: true },
    depth: 0,
    overrideAccess: true,
  })

  // pagination: false в некоторых адаптерах игнорирует limit — страхуемся.
  //
  // Оплаченные брони отфильтровываем в памяти, а не в `where`: условие
  // `payment.status != 'succeeded'` в SQL отбросило бы ещё и все записи с
  // NULL (то есть вообще без попытки оплаты) — то есть подавляющее большинство.
  const batch = expired.docs
    .filter((appointment) => {
      const paymentStatus = (appointment as { payment?: { status?: string | null } | null }).payment
        ?.status
      return paymentStatus !== 'succeeded'
    })
    .slice(0, maxBatch)

  if (batch.length === 0) return 0

  // Один UPDATE ... WHERE id IN (...) вместо N апдейтов. Повторная проверка
  // статуса в where отсекает брони, которые успели оплатить между find и update.
  const cancelled = await payload.update({
    collection: 'appointments',
    where: {
      id: { in: batch.map((appointment) => appointment.id) },
      status: { equals: 'pending_payment' },
    },
    data: { status: 'cancelled' },
    depth: 0,
    overrideAccess: true,
  })

  for (const error of cancelled.errors ?? []) {
    console.error('Failed to cancel expired hold', error)
  }

  const cancelledIds = new Set((cancelled.docs ?? []).map((doc) => doc.id))
  if (cancelledIds.size === 0) return 0

  // Группируем слоты по врачу: одна строка doctors — один update,
  // сколько бы броней у этого врача ни просрочилось.
  const slotsByDoctor = new Map<number, SlotRef[]>()

  for (const appointment of batch) {
    if (!cancelledIds.has(appointment.id)) continue

    const id = toId(appointment.doctor)
    if (!Number.isFinite(id)) continue

    const slots = slotsByDoctor.get(id) ?? []
    slots.push({ date: appointment.date, time: appointment.time })
    slotsByDoctor.set(id, slots)
  }

  for (const [id, slots] of slotsByDoctor) {
    try {
      await restoreDoctorSlots({ payload, doctorId: id, slots })
    } catch (err) {
      console.error('Failed to restore slots for doctor', id, err)
    }
  }

  return cancelledIds.size
}

/**
 * Освободить просроченные брони по требованию (пользователь закрыл вкладку и не оплатил).
 *
 * Штатно этим занимается фоновый sweeper (стартует из onInit в
 * src/payload.config.ts), но он ходит раз в минуту. Эта функция — адресный
 * проход по одному врачу или пользователю: её вызывают страницы
 * /doctor/[id] и /lk перед чтением данных, чтобы не показывать занятым слот,
 * бронь которого уже истекла. Также годится для скриптов и тестов.
 *
 * Запрос опирается на составной индекс (status, paymentExpiresAt) из коллекции
 * Appointments, поэтому в обычной ситуации (просрочек нет) стоит близко к нулю
 * независимо от размера таблицы.
 *
 * @returns количество освобождённых слотов, либо 0 если проход пропущен троттлом
 *          (см. SWEEP_THROTTLE_MS — по нулю нельзя судить о расписании)
 */
export async function releaseExpiredHolds({
  doctorId,
  userId,
  maxBatch,
}: SweepOptions = {}): Promise<number> {
  const scope = doctorId ? `doctor:${doctorId}` : userId ? `user:${userId}` : 'all'

  // Уже идёт такой же sweep — присоединяемся к нему вместо второго прохода.
  const inFlight = inFlightSweeps.get(scope)
  if (inFlight) return inFlight

  const last = lastSweepAt.get(scope) ?? 0
  if (Date.now() - last < SWEEP_THROTTLE_MS) return 0

  const sweep = runSweep({ doctorId, userId, maxBatch })
    .catch((err) => {
      console.error('Failed to release expired holds:', err)
      return 0
    })
    .finally(() => {
      lastSweepAt.set(scope, Date.now())
      inFlightSweeps.delete(scope)
    })

  inFlightSweeps.set(scope, sweep)
  return sweep
}

/** Как часто фоновый sweeper проверяет просроченные брони. */
const BACKGROUND_SWEEP_INTERVAL_MS = 60_000

/** Максимум проходов за один тик — чтобы дренаж очереди не крутился бесконечно. */
const BACKGROUND_SWEEP_MAX_PASSES = 5

/**
 * Один тик фонового sweeper'а.
 *
 * Если просрочек больше лимита пачки, добираем остаток следующими проходами
 * в этом же тике (но не больше BACKGROUND_SWEEP_MAX_PASSES), чтобы после
 * долгого простоя расписание не восстанавливалось по 1000 слотов в минуту.
 */
async function backgroundSweepTick(): Promise<number> {
  let total = 0

  for (let pass = 0; pass < BACKGROUND_SWEEP_MAX_PASSES; pass += 1) {
    // Скоуп 'all' занят исключительно фоновым проходом: страницы ходят
    // со скоупом doctor/user, та�� что троттл здесь не мешает.
    const released = await runSweep({ maxBatch: BACKGROUND_SWEEP_MAX_BATCH })
    total += released

    // Пачка неполная — значит просрочек больше не осталось.
    if (released < BACKGROUND_SWEEP_MAX_BATCH) break
  }

  return total
}

/**
 * Запустить фоновое освобождение просроченных броней.
 *
 * Рассчитано на долгоживущий сервер (`next start` под pm2/systemd): в отличие от
 * serverless, процесс живёт постоянно, поэтому таймер — самый простой планировщик,
 * без внешнего cron и без защищённого HTTP-роута.
 *
 * Вызывать ТОЛЬКО из onInit в src/payload.config.ts: он срабатывает один раз
 * на процесс, при первой инициализации Payload. На уровне модуля Next.js может
 * как не выполнить код вообще, так и выполнить его несколько раз (по разу на
 * воркер компиляции и на каждый серверный чанк), а instrumentation.ts здесь
 * не подходит — он компилируется ещё и для edge-рантайма, где payload
 * не резолвится (node:crypto).
 *
 * @returns функция остановки таймера
 */
export function startExpiredHoldsSweeper(): () => void {
  let running = false

  const tick = async () => {
    // Предыдущий тик ещё идёт (после простоя проход может быть долгим) — пропускаем.
    if (running) return
    running = true

    try {
      const released = await backgroundSweepTick()
      if (released > 0) {
        console.log(`[v0][holds-sweeper] released ${released} expired hold(s)`)
      }
    } catch (err) {
      console.error('[v0][holds-sweeper] sweep failed:', err)
    } finally {
      running = false
    }
  }

  const timer = setInterval(tick, BACKGROUND_SWEEP_INTERVAL_MS)

  // Таймер не должен сам удерживать процесс живым — за это отвечает http-сервер.
  timer.unref()

  // Первый проход �� с задержкой, чтобы не конкурировать с прогревом приложения.
  const warmup = setTimeout(tick, 10_000)
  warmup.unref()

  return () => {
    clearInterval(timer)
    clearTimeout(warmup)
  }
}

/**
 * Прочитать актуальное расписание врача напрямую из БД, минуя тегированный кеш.
 * Нужно сразу после освобождения слотов, чтобы страница показала их доступными.
 */
export async function getFreshDoctorSchedule(doctorId: number): Promise<DoctorScheduleDate[]> {
  try {
    const payload = await getPayloadInstance()
    const doctor = await payload.findByID({
      collection: 'doctors',
      id: doctorId,
      depth: 0,
      overrideAccess: true,
    })
    return filterFutureSchedule((doctor?.schedule || []) as DoctorScheduleDate[])
  } catch (err) {
    console.error('Failed to read fresh doctor schedule:', err)
    return []
  }
}
