// Просто проверка на то,что appointmentId - это число, больше нуля и тд
export default function isValidAppointmentId(appointmentId: unknown): appointmentId is number {
    return typeof appointmentId === 'number' && Number.isInteger(appointmentId) && appointmentId > 0
  }