import { NextRequest, NextResponse } from 'next/server'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import jwt from 'jsonwebtoken'

/**
 * POST /api/appointments/book
 * 
 * Creates an appointment and removes the booked slot from the doctor's schedule.
 * Only authenticated users (payload-token) can book.
 * 
 * Body: { doctorId: number, date: string (YYYY-MM-DD), time: string (HH:MM) }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify payload-token cookie
    const token = req.cookies.get('payload-token')?.value
    if (!token) {
      return NextResponse.json(
        { message: 'Необходимо войти в систему для записи' },
        { status: 401 },
      )
    }

    const payload = await getPayload({ config: configPromise })

    let decoded: any
    try {
      decoded = jwt.verify(token, payload.secret)
    } catch {
      return NextResponse.json(
        { message: 'Недействительный токен авторизации' },
        { status: 401 },
      )
    }

    if (!decoded?.id) {
      return NextResponse.json(
        { message: 'Недействительный токен авторизации' },
        { status: 401 },
      )
    }

    const userId = decoded.id

    // 2. Parse body
    const body = await req.json()
    const { doctorId, date, time } = body

    if (!doctorId || !date || !time) {
      return NextResponse.json(
        { message: 'doctorId, date и time обязательны' },
        { status: 400 },
      )
    }

    // 3. Fetch doctor and verify the slot exists
    const doctor = await payload.findByID({
      collection: 'doctors',
      id: doctorId,
      depth: 0,
    })

    if (!doctor) {
      return NextResponse.json(
        { message: 'Врач не найден' },
        { status: 404 },
      )
    }

    const schedule = doctor.schedule || []
    const dateEntry = schedule.find((s: any) => s.date === date)
    if (!dateEntry) {
      return NextResponse.json(
        { message: 'На выбранную дату нет доступных слотов' },
        { status: 400 },
      )
    }

    const slots = dateEntry.slots || []
    const slotIndex = slots.findIndex((s: any) => s.time === time)
    if (slotIndex === -1) {
      return NextResponse.json(
        { message: 'Выбранное время уже занято или недоступно' },
        { status: 400 },
      )
    }

    // 4. Fetch user info for snapshot
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
    })

    // 5. Create the appointment
    const appointment = await payload.create({
      collection: 'appointments',
      data: {
        user: userId,
        doctor: doctorId,
        date,
        time,
        status: 'scheduled',
        doctorName: doctor.name || doctor.email,
        userName: user.name || user.email,
        price: doctor.price ?? 0,
      },
    })

    // 6. Remove the booked slot from doctor's schedule
    const updatedSlots = slots.filter((_: any, i: number) => i !== slotIndex)
    
    let updatedSchedule
    if (updatedSlots.length === 0) {
      // Remove the entire date entry if no slots remain
      updatedSchedule = schedule.filter((s: any) => s.date !== date)
    } else {
      updatedSchedule = schedule.map((s: any) => {
        if (s.date === date) {
          return { ...s, slots: updatedSlots }
        }
        return s
      })
    }

    await payload.update({
      collection: 'doctors',
      id: doctorId,
      data: {
        schedule: updatedSchedule,
      },
    })

    return NextResponse.json({
      message: 'Запись успешно создана',
      appointment,
    })
  } catch (err: any) {
    console.error('Booking error:', err)
    const message = err?.message || 'Ошибка при создании записи'
    return NextResponse.json({ message }, { status: 500 })
  }
}
