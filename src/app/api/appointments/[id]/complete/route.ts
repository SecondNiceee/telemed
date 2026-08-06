import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

interface DecodedToken {
  id: number
  email: string
  collection: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const appointmentId = parseInt(id, 10)

    if (isNaN(appointmentId)) {
      return NextResponse.json(
        { message: 'Invalid appointment ID' },
        { status: 400 }
      )
    }

    // Check doctors-token cookie
    const cookieStore = await cookies()
    const doctorsToken = cookieStore.get('doctors-token')?.value

    if (!doctorsToken) {
      return NextResponse.json(
        { message: 'Unauthorized - doctors token required' },
        { status: 401 }
      )
    }

    // Decode token to get doctor ID
    const secret = process.env.PAYLOAD_SECRET
    if (!secret) {
      return NextResponse.json(
        { message: 'Server configuration error' },
        { status: 500 }
      )
    }

    let decoded: DecodedToken
    try {
      decoded = jwt.verify(doctorsToken, secret) as DecodedToken
    } catch {
      return NextResponse.json(
        { message: 'Invalid token' },
        { status: 401 }
      )
    }

    if (decoded.collection !== 'doctors') {
      return NextResponse.json(
        { message: 'Only doctors can complete appointments' },
        { status: 403 }
      )
    }

    const payload = await getPayload({ config })

    // Find the appointment
    const appointment = await payload.findByID({
      collection: 'appointments',
      id: appointmentId,
      overrideAccess: true,
    })

    if (!appointment) {
      return NextResponse.json(
        { message: 'Appointment not found' },
        { status: 404 }
      )
    }

    // Check if this doctor owns the appointment
    const appointmentDoctorId = typeof appointment.doctor === 'object' 
      ? appointment.doctor.id 
      : appointment.doctor

    if (appointmentDoctorId !== decoded.id) {
      return NextResponse.json(
        { message: 'You can only complete your own appointments' },
        { status: 403 }
      )
    }

    // Check if already completed
    if (appointment.status === 'completed') {
      return NextResponse.json(
        { message: 'Appointment is already completed' },
        { status: 400 }
      )
    }

    // Update appointment status to completed
    const updatedAppointment = await payload.update({
      collection: 'appointments',
      id: appointmentId,
      data: {
        status: 'completed',
      },
      overrideAccess: true,
    })

    return NextResponse.json(updatedAppointment)
  } catch (error) {
    console.error('Error completing appointment:', error)
    return NextResponse.json(
      { message: 'Failed to complete appointment' },
      { status: 500 }
    )
  }
}
