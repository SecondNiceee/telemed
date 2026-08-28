import crypto from 'crypto'
import type { Payload } from 'payload'

/**
 * Исполнение отзыва согласия на обработку персональных данных.
 *
 * Почему обезличивание, а не DELETE записи пользователя
 * ----------------------------------------------------
 * Соблазнительный вариант - `payload.delete({ collection: 'users' })`. Он
 * неверен по двум независимым причинам.
 *
 * 1. Уничтожает доказательство. В записи пользователя лежит снимок согласия:
 *    дата, версия, полный текст и IP акцепта (см. группу pdnConsent). Бремя
 *    доказывания того, что согласие было получено, лежит на операторе. Удалив
 *    запись, оператор остаётся без единственного доказательства - и на жалобу
 *    «обрабатывали без согласия» ответить нечем. Факт отзыва тоже нужно уметь
 *    показать: иначе не доказать, что обработка прекращена вовремя.
 *
 * 2. Рвёт учётные данные. К записям приёмов привязаны платежи ЮKassa (id
 *    платежа, сумма, возвраты). Это первичные данные бухгалтерского и
 *    налогового учёта со своими сроками хранения, и они не перестают быть
 *    нужными от того, что человек отозвал согласие на обработку ПДн.
 *
 * Закон различает удаление и обезличивание: обезличивание - обработка, после
 * которой данные нельзя соотнести с конкретным субъектом без дополнительной
 * информации. Ровно это здесь и делается: строки остаются, личные данные из них
 * уходят. Сумма платежа без имени, телефона и email - уже не персональные
 * данные, а сведения о хозяйственной операции.
 *
 * Что именно остаётся и почему это не «недоудаление»
 * --------------------------------------------------
 * Остаётся текст согласия, его версия и дата - но не сведения о том, кто его
 * дал. Утверждение превращается из «Иванов И.И., +7..., дал согласие версии v2»
 * в «аккаунт №123 дал согласие версии v2». Связь с человеком разорвана
 * намеренно: в этом и смысл обезличивания. Email и телефон НЕ сохраняются
 * «чтобы было чем доказывать» - это свело бы всю операцию на нет.
 *
 * Порядок операций имеет значение
 * -------------------------------
 * Сначала удаляются зависимые сущности (записи звонков, сообщения и их файлы),
 * потом обезличивается сам пользователь. Обратный порядок оставил бы, в случае
 * сбоя на середине, обезличенный аккаунт с живой перепиской - худшее из двух
 * состояний: и данные на месте, и найти их владельца уже нельзя.
 */

/** Имя-заглушка. Показывается врачу и в админке вместо настоящего. */
export const ANONYMIZED_NAME = 'Пользователь удалён'

/**
 * Email-заглушка на зарезервированном домене.
 *
 * `.invalid` - специальный TLD, который по RFC 2606 гарантированно никогда не
 * будет делегирован. Это важнее, чем кажется: заглушка вида
 * `deleted-123@example.com` рано или поздно превратилась бы в попытку письма на
 * чужой реально существующий домен. Уникальность (id в адресе) нужна из-за
 * уникального индекса на email.
 */
export function anonymizedEmail(userId: number | string): string {
  return `deleted-${userId}@removed.invalid`
}

/**
 * Телефон-заглушка.
 *
 * Поле phone обязательное, уникальное и проверяется регуляркой `^\+7\d{10}$` -
 * то есть просто занулить его нельзя, а значение обязано выглядеть как номер.
 * Берём код 000: он не выделяется ни одному оператору, поэтому заглушка не может
 * совпасть с чьим-то настоящим номером. id в конце даёт уникальность.
 */
export function anonymizedPhone(userId: number | string): string {
  return `+7${String(userId).padStart(10, '0')}`
}

/** Статусы, при которых консультация ещё предстоит или идёт. */
const ACTIVE_APPOINTMENT_STATUSES = ['pending_payment', 'confirmed', 'in_progress']

const CANCEL_REASON = 'Пациент отозвал согласие на обработку персональных данных'

/**
 * Собрать id всех документов по условию.
 *
 * Постранично, а не `limit: 0`: без ограничения одна выборка может поднять в
 * память всю переписку пользователя целиком.
 */
async function findAllIds(
  payload: Payload,
  collection: 'appointments' | 'call-recordings' | 'messages' | 'feedbacks',
  where: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  let page = 1

  for (;;) {
    const res = await payload.find({
      collection,
      where: where as Parameters<typeof payload.find>[0]['where'],
      depth: 0,
      limit: 200,
      page,
      overrideAccess: true,
    })

    out.push(...(res.docs as unknown as Record<string, unknown>[]))
    if (!res.hasNextPage) break
    page += 1
  }

  return out
}

/** id из значения связи: она может быть числом, строкой или раскрытым объектом. */
function toId(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  const value = typeof raw === 'object' ? (raw as { id?: unknown }).id : raw
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : null
}

/** Тихо удалить документ: отсутствующий файл не должен ронять всю операцию. */
async function safeDelete(
  payload: Payload,
  collection: 'media' | 'call-recordings' | 'messages',
  id: number,
  log: string[],
): Promise<boolean> {
  try {
    await payload.delete({ collection, id, overrideAccess: true })
    return true
  } catch (err) {
    log.push(`! не удалось удалить ${collection}#${id}: ${(err as Error).message}`)
    return false
  }
}

export interface AnonymizeResult {
  /** Человекочитаемый протокол — попадает в поле «Протокол исполнения». */
  log: string
  appointmentsAnonymized: number
  appointmentsCancelled: number
  recordingsDeleted: number
  messagesDeleted: number
  mediaDeleted: number
}

/**
 * Обезличить пользователя и удалить его медицинские материалы.
 *
 * Вызывать ТОЛЬКО из доверенного серверного кода: функция ходит через Local API
 * с overrideAccess и никаких прав не проверяет — это ответственность вызывающего.
 *
 * @param deleteMedicalRecords удалять ли записи консультаций и переписку.
 *   Вынесено в параметр, а не зашито: это единственная необратимая часть
 *   операции, и решение по ней принимает администратор явной отметкой.
 */
export async function anonymizeUser({
  payload,
  userId,
  deleteMedicalRecords,
}: {
  payload: Payload
  userId: number
  deleteMedicalRecords: boolean
}): Promise<AnonymizeResult> {
  const log: string[] = [`Отзыв согласия, пользователь #${userId}`]
  const stamp = new Date().toISOString()
  log.push(`Начато: ${stamp}`)

  let appointmentsCancelled = 0
  let recordingsDeleted = 0
  let messagesDeleted = 0
  let mediaDeleted = 0

  // --- 1. Приёмы пациента.
  const appointments = await findAllIds(payload, 'appointments', { user: { equals: userId } })
  const appointmentIds = appointments.map((a) => Number(a.id))
  log.push(`Найдено записей на приём: ${appointments.length}`)

  // --- 2. Отменить всё, что ещё предстоит.
  //
  // Без этого шага в расписании врача остался бы приём с пациентом, которого
  // уже нельзя ни идентифицировать, ни уведомить. Отзыв согласия делает
  // проведение консультации невозможным, поэтому активные записи закрываются.
  for (const appt of appointments) {
    if (!ACTIVE_APPOINTMENT_STATUSES.includes(String(appt.status))) continue

    try {
      await payload.update({
        collection: 'appointments',
        id: Number(appt.id),
        data: { status: 'cancelled', reason: CANCEL_REASON },
        overrideAccess: true,
      })
      appointmentsCancelled += 1
    } catch (err) {
      log.push(`! не удалось отменить приём #${appt.id}: ${(err as Error).message}`)
    }
  }
  log.push(`Отменено активных приёмов: ${appointmentsCancelled}`)

  // --- 3. Записи консультаций и переписка.
  if (deleteMedicalRecords && appointmentIds.length > 0) {
    // Видеозаписи. Файл лежит в отдельной коллекции media, поэтому удаляются
    // обе сущности: удаление только карточки записи оставило бы сам видеофайл
    // доступным по прямой ссылке.
    const recordings = await findAllIds(payload, 'call-recordings', {
      appointment: { in: appointmentIds },
    })

    for (const rec of recordings) {
      const mediaId = toId(rec.video)
      if (await safeDelete(payload, 'call-recordings', Number(rec.id), log)) recordingsDeleted += 1
      if (mediaId && (await safeDelete(payload, 'media', mediaId, log))) mediaDeleted += 1
    }
    log.push(`Удалено записей звонков: ${recordingsDeleted}`)

    // Сообщения чата вместе с вложениями.
    //
    // Удаляется вся переписка приёма, а не только реплики пациента: оставленные
    // ответы врача - это его вопросы и рекомендации, из которых содержание
    // жалоб пациента восстанавливается почти дословно. Половинчатое удаление
    // здесь создаёт видимость результата, а не результат.
    const messages = await findAllIds(payload, 'messages', {
      appointment: { in: appointmentIds },
    })

    for (const msg of messages) {
      const attachmentId = toId(msg.attachment)
      if (await safeDelete(payload, 'messages', Number(msg.id), log)) messagesDeleted += 1
      if (attachmentId && (await safeDelete(payload, 'media', attachmentId, log))) mediaDeleted += 1
    }
    log.push(`Удалено сообщений: ${messagesDeleted}`)

    // Запись, прикреплённая к самому приёму (поле recording), - отдельная от
    // коллекции call-recordings ссылка на media. Пропустить её значит оставить
    // видеофайл на диске.
    for (const appt of appointments) {
      const mediaId = toId(appt.recording)
      if (!mediaId) continue

      try {
        await payload.update({
          collection: 'appointments',
          id: Number(appt.id),
          data: { recording: null },
          overrideAccess: true,
        })
      } catch (err) {
        log.push(`! не удалось отвязать запись у приёма #${appt.id}: ${(err as Error).message}`)
      }

      if (await safeDelete(payload, 'media', mediaId, log)) mediaDeleted += 1
    }
  } else if (!deleteMedicalRecords) {
    log.push('Записи консультаций и переписка СОХРАНЕНЫ (удаление не подтверждено)')
  }

  // --- 4. Обезличить денормализованные копии имени в приёмах.
  //
  // userName - копия имени, сохранённая в самой записи приёма для отображения.
  // Она не изменится от правки профиля, поэтому без этого шага ФИО пациента
  // осталось бы в базе даже после полной очистки аккаунта.
  let appointmentsAnonymized = 0
  for (const appt of appointments) {
    if (!appt.userName || appt.userName === ANONYMIZED_NAME) continue

    try {
      await payload.update({
        collection: 'appointments',
        id: Number(appt.id),
        data: { userName: ANONYMIZED_NAME },
        overrideAccess: true,
      })
      appointmentsAnonymized += 1
    } catch (err) {
      log.push(`! не удалось обезличить приём #${appt.id}: ${(err as Error).message}`)
    }
  }
  log.push(`Обезличено имён в приёмах: ${appointmentsAnonymized}`)

  // --- 5. Отзывы.
  //
  // Остаются на месте и связанными с обезличенным аккаунтом: поле user у отзыва
  // обязательное, а сам текст - добровольно опубликованное автором сообщение о
  // работе врача, а не сведения о его здоровье. После обезличивания профиля
  // отзыв подписан заглушкой. Если в тексте есть личные подробности, отзыв
  // удаляется администратором вручную - автоматика не может отличить их от
  // обычной оценки приёма.
  const feedbacks = await findAllIds(payload, 'feedbacks', { user: { equals: userId } })
  if (feedbacks.length > 0) {
    log.push(
      `Отзывов оставлено без изменений: ${feedbacks.length} ` +
        `(id: ${feedbacks.map((f) => f.id).join(', ')}) — проверить вручную`,
    )
  }

  // --- 6. Сам аккаунт.
  //
  // Пароль заменяется случайным: email уже недействителен, но без смены пароля
  // остаётся действующая сессия и возможность входа по старым данным, если email
  // где-то закэширован. Восстановить доступ по такому паролю нельзя - он никуда
  // не сохраняется.
  // Группы согласия и оферты переписываются целиком, а не точечной нотацией
  // `pdnConsent.ip`: Local API не разбирает такие ключи, а передача частичного
  // объекта группы `{ ip: null }` затёрла бы соседние поля - то есть как раз
  // дату, версию и текст, которые мы обязаны сохранить. Поэтому текущие
  // значения сначала читаются и переносятся дословно.
  const current = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    overrideAccess: true,
  })

  const pdnConsent = (current?.pdnConsent ?? {}) as Record<string, unknown>
  const offerAcceptance = (current?.offerAcceptance ?? {}) as Record<string, unknown>

  await payload.update({
    collection: 'users',
    id: userId,
    data: {
      name: ANONYMIZED_NAME,
      email: anonymizedEmail(userId),
      phone: anonymizedPhone(userId),
      password: crypto.randomBytes(32).toString('hex'),
      // IP акцепта - персональные данные, и в отличие от текста согласия
      // никакой доказательной ценности после отзыва не несут.
      pdnConsent: { ...pdnConsent, ip: null },
      offerAcceptance: { ...offerAcceptance, ip: null },
    } as Record<string, unknown>,
    overrideAccess: true,
  })
  log.push('Профиль обезличен: имя, email, телефон, IP акцептов, пароль сброшен')
  log.push(
    'Сохранены как доказательство: дата, версия и текст согласия и оферты — ' +
      'без сведений о том, кто их принял',
  )
  log.push(`Завершено: ${new Date().toISOString()}`)

  return {
    log: log.join('\n'),
    appointmentsAnonymized,
    appointmentsCancelled,
    recordingsDeleted,
    messagesDeleted,
    mediaDeleted,
  }
}
