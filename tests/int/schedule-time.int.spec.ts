import { describe, expect, it } from 'vitest'
import {
  filterFutureSchedule,
  getScheduleSlotDate,
  isScheduleSlotFuture,
} from '@/lib/schedule-time'

const now = new Date(2026, 7, 18, 12, 30, 0, 0)

describe('schedule time utilities', () => {
  it('accepts a future date and a later time today', () => {
    expect(isScheduleSlotFuture('2026-08-19', '00:00', now)).toBe(true)
    expect(isScheduleSlotFuture('2026-08-18', '12:31', now)).toBe(true)
  })

  it('rejects past slots and the current moment', () => {
    expect(isScheduleSlotFuture('2026-08-17', '23:59', now)).toBe(false)
    expect(isScheduleSlotFuture('2026-08-18', '12:29', now)).toBe(false)
    expect(isScheduleSlotFuture('2026-08-18', '12:30', now)).toBe(false)
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
          { date: '2026-08-18', slots: [{ time: '12:00' }, { time: '13:00' }] },
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
