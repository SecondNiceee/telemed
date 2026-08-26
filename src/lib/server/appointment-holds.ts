import 'server-only'

import { getPayload } from 'payload'
import config from '@payload-config'
import type { DoctorScheduleDate } from '@/lib/api/types'
import { filterFutureSchedule } from '@/lib/schedule-time'
import { sendAppointmentCancellationEmail } from '@/utils/sendAppointmentEmail'

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

export type AppointmentMoneyState = {
  paidAt?: string | null
  payment?: { status?: string | null; paymentId?: string | null; refundId?: string | null } | null
}

/**
 * Почему запись нельзя удалить.
 *
 * `settled` / `refunded` — деньги реально двигались, это повод для внимания.
 * `live_payment` — рутина: платёж создан и ещё может быть оплачен, запись просто
 * ждёт сверки (`reconcileAbandonedPayments`). Разделение нужно, чтобы сверка,
 * проходящая по таким записям раз в несколько минут, не засыпала лог warn'ами.
 */
type MoneyKeepReason = 'settled' | 'refunded' | 'live_payment'

/**
 * С записью связаны деньги — уже прошедшие или ещё возможные. Удалять нельзя.
 *
 * Два разных повода сохранить запись:
 *
 * 1. Деньги уже двигались (`paidAt`, `refundId`, статус succeeded /
 *    waiting_for_capture / refunded). Удалив запись, мы потеряли бы paymentId
 *    и refundId — единственный след операции на нашей стороне.
 *
 * 2. Платёж создан и ещё жив (обычно статус `pending`). Пациент может оплатить
 *    его уже ПОСЛЕ истечения брони — ссылка на оплату так и остаётся открытой
 *    у него в браузере. Запись здесь единственная связь между платежом и
 *    консультацией: `handleYooKassaNotification` ищет её по `payment.paymentId`,
 *    и если не находит — просто пишет «уведомление о неизвестном платеже» и
 *    выходит, НЕ возвращая деньги. То есть после удаления такой брони деньги
 *    остаются у нас, а у пациента нет ни консультации, ни возврата.
 *
 * Удаляем поэтому только два безопасных случая: платежа не было вовсе (пациент
 * даже не нажал «Оплатить» — это абсолютное большинство брошенных броней) и
 * платёж окончательно мёртв (`canceled` — по нему ЮKassa денег уже не примет).
 */
function moneyKeepReason(appointment: AppointmentMoneyState): MoneyKeepReason | null {
  if (appointment.paidAt) return 'settled'

  const payment = appointment.payment
  if (payment?.refundId) return 'refunded'

  // Платежа не было — удалять безопасно.
  if (!payment?.paymentId) return null

  // Платёж есть: удаляем только если он уже не может быть оплачен.
  if (payment.status === 'canceled') return null

  return payment.status === 'succeeded' || payment.status === 'refunded'
    ? 'settled'
    : 'live_payment'
}

/**
 * Убрать снятую бронь из истории, если с ней не связан платёж.
 *
 * Неоплаченная бронь — это мусор, а не отмена консультации: пациент ничего
 * не оплачивал, врач ничего не отменял. Поэтому такая запись удаляется, а не
 * копится в личном кабинете под видом отменённой консультации.
 *
 * Вызывать ТОЛЬКО после того, как слот уже вернулся в расписание и транзакция
 * закоммичена. Если удаление внутри транзакции упадёт (например, к записи
 * успели привязать сообщение и FK не даёт её убрать), откатится и возврат
 * слота — а потерять слот куда хуже, чем оставить лишнюю строку. При неудаче
 * запись просто остаётся в статусе «Отменена», как было раньше.
 *
 * @returns true, если запись удалена
 */
export async function deleteReleasedHold({
  payload,
  appointment,
}: {
  payload: PayloadInstance
  appointment: AppointmentMoneyState & { id: number }
}): Promise<boolean> {
  const keepReason = moneyKeepReason(appointment)

  if (keepReason) {
    // Живой платёж — штатная ситуация, а не инцидент: его добьёт сверка
    // `reconcileAbandonedPayments`, и запись удалится следующим проходом.
    if (keepReason !== 'live_payment') {
      console.warn('[v0][holds] с бронью связаны деньги — оставляем запись отменённой', {
        appointmentId: appointment.id,
        paymentStatus: appointment.payment?.status ?? null,
        reason: keepReason,
      })
    }
    return false
  }

  try {
    await payload.delete({
      collection: 'appointments',
      id: appointment.id,
      overrideAccess: true,
    })
    return true
  } catch (err) {
    // Слот уже свободен, поэтому это не критично: запись останется «Отменена».
    console.error('Failed to delete unpaid appointment hold', appointment.id, err)
    return false
  }
}

/**
 * Снять неоплаченную бронь, вернуть слот врачу и убрать запись из истории.
 *
 * Запись удаляется, а не остаётся «Отменена»: истёкшая бронь означает, что
 * пациент просто не довёл оплату до конца. Исключение — брони со связанным
 * платежом (см. mustKeepForMoney): они остаются отменёнными.
 *
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

  // Слот уже вернулся врачу — теперь убираем саму запись, чтобы неоплаченная
  // бронь не осела в личном кабинете как «отменённая консультация».
  // Строго после коммита: см. предупреждение в deleteReleasedHold.
  await deleteReleasedHold({
    payload,
    appointment: appointment as AppointmentMoneyState & { id: number },
  })

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
 * страница врача, отдавая расписание из кеша).
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
    // findByID на каждую бронь. `payment` и `paidAt` нужны дважды: чтобы не
    // отменить бронь, деньги за которую уже получены, и чтобы решить, можно ли
    // удалять запись или в ней остался след движения денег.
    select: {
      doctor: true,
      doctorName: true,
      user: true,
      userName: true,
      date: true,
      time: true,
      paidAt: true,
      payment: true,
    },
    depth: 1,
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

  for (const appointment of batch) {
    if (!cancelledIds.has(appointment.id)) continue

    const user = typeof appointment.user === 'object' ? appointment.user : null
    if (user?.email) {
      try {
        await sendAppointmentCancellationEmail({
          payload,
          patientEmail: user.email,
          patientName: appointment.userName || user.name || 'Пациент',
          doctorName: appointment.doctorName || 'Врач',
          date: appointment.date,
          time: appointment.time,
          reason: 'Консультация была отменена из-за неоплаты.',
        })
      } catch (err) {
        console.error('Failed to send unpaid appointment cancellation email', err)
      }
    }

    // Через тот же helper, что и releaseHold: иначе здесь удалилась бы и
    // бронь, по которой деньги пришли поздно и уже были возвращены (её
    // payment.status = 'refunded', и в батч она попадает), а вместе с ней —
    // refundId, единственный наш след возврата.
    await deleteReleasedHold({
      payload,
      appointment: appointment as AppointmentMoneyState & { id: number },
    })
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

/** Подсчитать суммарное число слотов в расписании (для дешёвого сравнения «изменилось/нет»). */
function countSlots(schedule: DoctorScheduleDate[]): number {
  return schedule.reduce((total, day) => total + (day.slots?.length ?? 0), 0)
}

/**
 * Максимум врачей, чьё расписание чистим за один проход.
 *
 * Прошедшие свободные слоты не требуют срочной уборки (они везде отфильтрованы
 * при чтении через filterFutureSchedule), поэтому разбираем их спокойными
 * пачками, не нагружая БД разом.
 */
const PRUNE_MAX_BATCH = 200

/**
 * Физически удалить из расписания врачей прошедшие свободные слоты.
 *
 * Зачем это нужно, хотя слоты и так скрыты фильтром при чтении: без уборки JSON
 * `doctors.schedule` бесконечно копит «мёртвые» прошедшие слоты, по которым уже
 * никто не запишется. На appointments это НЕ влияет — занятый слот удаляется из
 * schedule ещё в момент записи, так что здесь остаются только незанятые времена.
 *
 * Идёт пачками: за проход берём до PRUNE_MAX_BATCH врачей, у которых вообще есть
 * расписание, и переписываем строку только если что-то реально изменилось.
 *
 * @returns количество врачей, чьё расписание было почищено
 */
async function pruneDoctorsPastSlots(): Promise<number> {
  const payload = await getPayloadInstance()

  const doctors = await payload.find({
    collection: 'doctors',
    where: {
      // Есть хотя бы один день в расписании — иначе чистить нечего.
      'schedule.date': { exists: true },
    },
    pagination: false,
    limit: PRUNE_MAX_BATCH,
    select: { schedule: true },
    depth: 0,
    overrideAccess: true,
  })

  const now = new Date()
  let pruned = 0

  for (const doctor of doctors.docs) {
    const schedule = (doctor.schedule || []) as DoctorScheduleDate[]
    const filtered = filterFutureSchedule(schedule, now)

    // Ничего не удалилось — не трогаем строку (меньше записей = меньше нагрузки).
    if (countSlots(filtered) === countSlots(schedule) && filtered.length === schedule.length) {
      continue
    }

    try {
      await payload.update({
        collection: 'doctors',
        id: doctor.id,
        data: { schedule: filtered },
        depth: 0,
        overrideAccess: true,
      })
      pruned += 1
    } catch (err) {
      console.error('Failed to prune past slots for doctor', doctor.id, err)
    }
  }

  return pruned
}

/** Как часто фоновый sweeper проверяет просроченные брони. */
const BACKGROUND_SWEEP_INTERVAL_MS = 60_000

/**
 * Как часто чистим прошедшие свободные слоты.
 *
 * Реже, чем разбор броней: срочности нет (слоты и так скрыты при чтении),
 * а проход идёт по всем врачам, а не по индексу просроченных броней.
 */
const PRUNE_INTERVAL_MS = 60 * 60 * 1000

/** Максимум проходов за один тик — чтобы дренаж очереди не крутился бесконечно. */
const BACKGROUND_SWEEP_MAX_PASSES = 5

/**
 * Как часто сверять платежи по уже отменённым броням.
 *
 * Реже, чем разбор броней: каждый такой шаг — сетевой запрос в ЮKassa, и
 * торопиться некуда (слот врачу уже вернулся, речь только о судьбе денег и об
 * уборке записи). Свой троттл есть и внутри `reconcileAbandonedPayments`, так
 * что одна и та же запись не опрашивается на каждом проходе.
 */
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000

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
    // со скоупом doctor/user, так что троттл здесь не мешает.
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
  let lastPruneAt = 0
  let lastReconcileAt = 0

  const tick = async () => {
    // Предыдущий тик ещё идёт (после простоя проход может быть долгим) — пропускаем.
    if (running) return
    running = true

    try {
      const released = await backgroundSweepTick()
      if (released > 0) {
        console.log(`[v0][holds-sweeper] released ${released} expired hold(s)`)
      }

      // Сверка платежей по отменённым броням: она решает судьбу денег (вернуть
      // запоздавшую оплату) и убирает записи, чей платёж окончательно мёртв.
      //
      // Импорт динамический: appointment-payments статически импортирует этот
      // модуль (releaseHold), и обычный import замкнул бы цикл — при загрузке
      // одного из модулей второй оказался бы ещё не инициализирован.
      if (Date.now() - lastReconcileAt >= RECONCILE_INTERVAL_MS) {
        lastReconcileAt = Date.now()

        try {
          const { reconcileAbandonedPayments } = await import('./appointment-payments')
          const { checked, refunded, deleted } = await reconcileAbandonedPayments()

          if (checked > 0) {
            console.log(
              `[v0][holds-sweeper] reconciled ${checked} abandoned payment(s): ${refunded} refunded, ${deleted} record(s) removed`,
            )
          }
        } catch (err) {
          // Сверка не должна ронять основной проход по броням.
          console.error('[v0][holds-sweeper] payment reconciliation failed:', err)
        }
      }

      // Уборка прошедших свободных слотов — раз в час, не на каждом тике.
      if (Date.now() - lastPruneAt >= PRUNE_INTERVAL_MS) {
        lastPruneAt = Date.now()
        const pruned = await pruneDoctorsPastSlots()
        if (pruned > 0) {
          console.log(`[v0][holds-sweeper] pruned past slots for ${pruned} doctor(s)`)
        }
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

  // Первый проход с задержкой, чтобы не конкурировать с прогревом приложения.
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
