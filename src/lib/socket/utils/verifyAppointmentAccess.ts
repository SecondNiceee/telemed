import { Appointment } from "@/payload-types"
import { Payload } from "payload"

// Полноценная функция , которая проверяет доступ к этой записи
export default async function verifyAppointmentAccess(
    payload: Payload,
    appointmentId: number,
    allUserIds: number[],
    allDoctorIds: number[]
  ): Promise<{ 
    hasAccess: boolean
    accessType?: 'user' | 'doctor'
    accessId?: number
    appointment?: Appointment // Return appointment for reuseq
  }> {
    try {
      const appointment = await payload.findByID({
        collection: 'appointments',
        id: appointmentId,
        overrideAccess: true,
      })
  
      if (!appointment) return { hasAccess: false }
  
      // Check if any of the user IDs match
      const appointmentUserId = typeof appointment.user === 'object' 
        ? (appointment.user as { id: number }).id 
        : appointment.user
      for (const userId of allUserIds) {
        if (appointmentUserId === userId) {
          return { hasAccess: true, accessType: 'user', accessId: userId, appointment }
        }
      }
  
      // Check if any of the doctor IDs match
      const appointmentDoctorId = typeof appointment.doctor === 'object' 
        ? (appointment.doctor as { id: number }).id 
        : appointment.doctor
      for (const doctorId of allDoctorIds) {
        if (appointmentDoctorId === doctorId) {
          return { hasAccess: true, accessType: 'doctor', accessId: doctorId, appointment }
        }
      }
  
      return { hasAccess: false }
    } catch {
      return { hasAccess: false }
    }
  }