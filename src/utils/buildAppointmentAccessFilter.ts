import type { Where } from 'payload'

/**
 * Строит фильтр доступа для сообщений на основе appointment.
 * 
 * @param userId - ID пользователя (из токена users) или null
 * @param doctorId - ID врача (из токена doctors) или null
 * @param doctorIds - Массив ID врачей (для организаций) или null
 * @returns Where-условие для фильтрации или false если нет доступа
 */
export function buildAppointmentAccessFilter(
  userId: number | null,
  doctorId: number | null,
  doctorIds?: number[] | null
): Where | false {
  const conditions: Where[] = []

  // User reads messages from their appointments
  if (userId) {
    conditions.push({
      'appointment.user': { equals: userId },
    })
  }

  // Doctor reads messages from their appointments
  if (doctorId) {
    conditions.push({
      'appointment.doctor': { equals: doctorId },
    })
  }

  // Organisation reads messages from their doctors' appointments
  if (doctorIds && doctorIds.length > 0) {
    conditions.push({
      'appointment.doctor': { in: doctorIds },
    })
  }

  // Нет условий - нет доступа
  if (conditions.length === 0) {
    return false
  }

  // Одно условие - возвращаем его напрямую
  if (conditions.length === 1) {
    return conditions[0]
  }

  // Несколько условий - объединяем через OR
  return { or: conditions } as Where
}
