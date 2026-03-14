import { Appointment } from "@/payload-types"
import { Payload } from "payload"

// Полноценная функция , которая проверяет доступ к этой записи
export default async function verifyAppointmentAccess(
    payload: Payload,
    appointmentId: number,
    userId?: number,
    doctorId?: number
  ): Promise<{ 
    hasAccess: boolean
    accessType?: 'user' | 'doctor'
    accessId?: number
    appointment?: Appointment
  }> {
    try {
      const appointment = await payload.findByID({
        collection: 'appointments',
        id: appointmentId,
        overrideAccess: true,
      })
  
      if (!appointment) return { hasAccess: false }
  
      // Check if user ID matches
      const appointmentUserId = typeof appointment.user === 'object' 
        ? (appointment.user as { id: number }).id 
        : appointment.user
      if (userId && appointmentUserId === userId) {
        return { hasAccess: true, accessType: 'user', accessId: userId, appointment }
      }
  
      // Check if doctor ID matches
      const appointmentDoctorId = typeof appointment.doctor === 'object' 
        ? (appointment.doctor as { id: number }).id 
        : appointment.doctor
      if (doctorId && appointmentDoctorId === doctorId) {
        return { hasAccess: true, accessType: 'doctor', accessId: doctorId, appointment }
      }
  
      return { hasAccess: false }
    } catch {
      return { hasAccess: false }
    }
  }
