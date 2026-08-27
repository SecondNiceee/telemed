import type { Payload } from 'payload'

/**
 * Пометки приватности для файла в коллекции media.
 *
 * В media лежат файлы двух совершенно разных сортов:
 *  - публичные: фото врачей, иконки категорий. Их обязан видеть анонимный
 *    посетитель, иначе каталог на сайте останется без картинок;
 *  - приватные: записи консультаций и вложения чатов. Это данные о здоровье,
 *    то есть специальная категория персональных данных.
 *
 * Раньше вся коллекция отдавалась правилом `read: () => true`, поэтому вторая
 * группа была доступна без авторизации. Разделить их можно только явной
 * пометкой на документе - по mime-типу нельзя, потому что вложением чата
 * бывает обычная картинка, ничем не отличимая от фото врача.
 *
 * Доступ описан двумя одиночными связями, а не списками: и запись приёма, и
 * вложение чата всегда относятся к одной консультации, то есть к одному
 * пациенту и одному врачу. Одиночная связь в Postgres - это обычная колонка
 * allowed_user_id, тогда как hasMany потребовал бы отдельную таблицу связей и
 * join на каждой отдаче файла.
 */
export interface MediaPrivacy {
  visibility: 'private'
  /** Пациент, которому разрешён доступ к файлу. */
  allowedUser: number | null
  /** Врач, которому разрешён доступ к файлу. */
  allowedDoctor: number | null
}

/** Достаёт числовой id из связи, которая приходит и числом, и объектом. */
function toId(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object' && 'id' in value) {
    const id = Number((value as { id: unknown }).id)
    return Number.isFinite(id) ? id : null
  }
  const id = Number(value)
  return Number.isFinite(id) ? id : null
}

/**
 * Права на файл по участникам консультации, без обращения к базе.
 *
 * Нужна там, где консультация уже загружена (например, в обработчике
 * сообщений): вложение чата должно открываться обоим участникам переписки и
 * никому больше.
 */
export function buildParticipantsPrivacy(patientId: unknown, doctorId: unknown): MediaPrivacy {
  return {
    visibility: 'private',
    allowedUser: toId(patientId),
    allowedDoctor: toId(doctorId),
  }
}

/**
 * Считает права на файл записи консультации: доступ получают лечащий врач и
 * пациент из этой консультации.
 *
 * Пациента приходится доставать из appointment отдельным запросом: во всех
 * трёх местах, где создаётся запись звонка, на руках есть только
 * appointmentId и doctorId.
 *
 * Ошибка запроса не должна ронять финализацию записи - файл к этому моменту
 * уже склеен и лежит на диске. Поэтому при сбое возвращаем самый закрытый
 * вариант: доступ только у врача (и у админа, у него отдельное правило).
 * Потерять доступ пациента менее опасно, чем отдать файл всем.
 */
export async function buildRecordingPrivacy(
  payload: Payload,
  appointmentId: number | string,
  doctorId: number | string,
): Promise<MediaPrivacy> {
  try {
    const appointment = await payload.findByID({
      collection: 'appointments',
      id: appointmentId,
      depth: 0,
      overrideAccess: true,
    })

    return buildParticipantsPrivacy((appointment as { user?: unknown }).user, doctorId)
  } catch (error) {
    console.error('[media-privacy] Не удалось определить пациента консультации', {
      appointmentId,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    })
    return buildParticipantsPrivacy(null, doctorId)
  }
}
