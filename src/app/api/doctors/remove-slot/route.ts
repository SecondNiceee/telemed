import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { revalidateTag } from 'next/cache'
import { DOCTORS_CACHE_TAG } from '@/lib/api/doctors'

export async function POST(req: NextRequest) {
  try {
    const { doctorId, date, time } = await req.json()

    if (!doctorId || !date || !time) {
      return NextResponse.json({ error: 'Missing doctorId, date, or time' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    const doctor = await payload.findByID({
      collection: 'doctors',
      id: Number(doctorId),
    })

    if (!doctor?.schedule) {
      return NextResponse.json({ ok: true, message: 'No schedule found' })
    }

    const rawSchedule = doctor.schedule as { date: string; slots?: { time: string }[] }[]

    const updatedSchedule = rawSchedule
      .map((dayEntry) => {
        if (dayEntry.date === date) {
          return {
            ...dayEntry,
            slots: (dayEntry.slots || []).filter((slot) => slot.time !== time),
          }
        }
        return dayEntry
      })
      .filter((dayEntry) => dayEntry.slots && dayEntry.slots.length > 0)

    await payload.update({
      collection: 'doctors',
      id: Number(doctorId),
      data: { schedule: updatedSchedule },
    })

    revalidateTag(DOCTORS_CACHE_TAG)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[remove-slot] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
