import { describe, expect, it } from 'vitest'
import {
  BOOKING_LEAD_TIME_MINUTES,
  filterFutureSchedule,
  getScheduleSlotDate,
  isScheduleSlotFuture,
  SLOT_UNAVAILABLE_MESSAGE,
} from '@/lib/schedule-time'

const now = new Date(2026, 7, 18, 12, 30, 0, 0)

describe('schedule time utilities', () => {
  it('shares one booking cutoff and conflict message across booking flows', () => {
    expect(BOOKING_LEAD_TIME_MINUTES).toBe(30)
    expect(SLOT_UNAVAILABLE_MESSAGE).toBe('Консультация была выбрана другим пользователем')
  })

  it('accepts slots with at least 30 minutes remaining', () => {
    expect(isScheduleSlotFuture('2026-08-19', '00:00', now)).toBe(true)
    expect(isScheduleSlotFuture('2026-08-18', '13:00', now)).toBe(true)
  })

  it('rejects slots inside the 30-minute booking cutoff', () => {
    expect(isScheduleSlotFuture('2026-08-17', '23:59', now)).toBe(false)
    expect(isScheduleSlotFuture('2026-08-18', '12:30', now)).toBe(false)
    expect(isScheduleSlotFuture('2026-08-18', '12:59', now)).toBe(false)
  })

  it('rejects invalid calendar dates and times', () => {
    expect(getScheduleSlotDate('2026-02-30', '10:00')).toBeNull()
    expect(getScheduleSlotDate('18.08.2026', '10:00')).toBeNull()
    expect(getScheduleSlotDate('2026-08-18', '24:00')).toBeNull()
    expect(getScheduleSlotDate('2026-08-18', '9:00')).toBeNull()
  })

  it('removes expired slots and empty dates', () => {
    expect(
      filterFutureSchedule(
        [
          { date: '2026-08-17', slots: [{ time: '18:00' }] },
          { date: '2026-08-18', slots: [{ time: '12:00' }, { time: '12:59' }, { time: '13:00' }] },
          { date: '2026-08-19', slots: [{ time: '09:00' }] },
        ],
        now,
      ),
    ).toEqual([
      { date: '2026-08-18', slots: [{ time: '13:00' }] },
      { date: '2026-08-19', slots: [{ time: '09:00' }] },
    ])
  })
})
