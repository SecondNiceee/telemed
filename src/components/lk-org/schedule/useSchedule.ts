import { useState, useEffect, useCallback, useMemo } from "react"
import { DoctorsApi } from "@/lib/api/doctors"
import type { DoctorScheduleDate, DoctorScheduleSlot } from "@/lib/api/types"
import { toDateStr, sortSlots } from "./schedule-helpers"

interface UseScheduleResult {
  schedule: DoctorScheduleDate[]
  slotDuration: string
  setSlotDuration: (v: string) => void
  doctorName: string
  fetchLoading: boolean
  saving: boolean
  saved: boolean
  error: string
  scheduleMap: Map<string, DoctorScheduleDate>
  getDateEntry: (dateStr: string) => DoctorScheduleDate | undefined
  addSlot: (dateStr: string, time: string) => void
  removeSlot: (dateStr: string, time: string) => void
  clearDate: (dateStr: string) => void
  setDateSlots: (dateStr: string, slots: DoctorScheduleSlot[]) => void
  handleSave: () => Promise<void>
  today: Date
  maxDate: Date
}

export function useSchedule(doctorId: number): UseScheduleResult {
  const [schedule, setSchedule] = useState<DoctorScheduleDate[]>([])
  const [slotDuration, setSlotDurationState] = useState("30")
  const [doctorName, setDoctorName] = useState("")
  const [fetchLoading, setFetchLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const today = useMemo(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), n.getDate())
  }, [])

  const maxDate = useMemo(() => {
    const d = new Date(today)
    d.setFullYear(d.getFullYear() + 1)
    return d
  }, [today])

  const loadDoctor = useCallback(async () => {
    try {
      setFetchLoading(true)
      const doctor = await DoctorsApi.fetchById(doctorId)
      setDoctorName(doctor.name || doctor.email)
      setSlotDurationState(doctor.slotDuration || "30")
      const todayStr = toDateStr(today)
      const existing = (doctor.schedule || []).filter((d) => d.date >= todayStr)
      setSchedule(existing)
    } catch {
      setError("Не удалось загрузить данные врача")
    } finally {
      setFetchLoading(false)
    }
  }, [doctorId, today])

  useEffect(() => {
    loadDoctor()
  }, [loadDoctor])

  const scheduleMap = useMemo(() => {
    const map = new Map<string, DoctorScheduleDate>()
    for (const entry of schedule) map.set(entry.date, entry)
    return map
  }, [schedule])

  const getDateEntry = useCallback(
    (dateStr: string) => scheduleMap.get(dateStr),
    [scheduleMap],
  )

  const setDateSlots = useCallback((dateStr: string, slots: DoctorScheduleSlot[]) => {
    setSaved(false)
    setSchedule((prev) => {
      const idx = prev.findIndex((d) => d.date === dateStr)
      if (slots.length === 0) {
        if (idx === -1) return prev
        return prev.filter((d) => d.date !== dateStr)
      }
      if (idx === -1) {
        return [...prev, { date: dateStr, slots: sortSlots(slots) }].sort((a, b) =>
          a.date.localeCompare(b.date),
        )
      }
      const next = [...prev]
      next[idx] = { ...next[idx], slots: sortSlots(slots) }
      return next
    })
  }, [])

  const addSlot = useCallback(
    (dateStr: string, time: string) => {
      const entry = scheduleMap.get(dateStr)
      const slots = entry?.slots || []
      if (slots.some((s) => s.time === time)) return
      setDateSlots(dateStr, [...slots, { time }])
    },
    [scheduleMap, setDateSlots],
  )

  const removeSlot = useCallback(
    (dateStr: string, time: string) => {
      const entry = scheduleMap.get(dateStr)
      if (!entry) return
      setDateSlots(dateStr, entry.slots.filter((s) => s.time !== time))
    },
    [scheduleMap, setDateSlots],
  )

  const clearDate = useCallback(
    (dateStr: string) => setDateSlots(dateStr, []),
    [setDateSlots],
  )

  const setSlotDuration = useCallback((v: string) => {
    setSlotDurationState(v)
    setSaved(false)
  }, [])

  const handleSave = useCallback(async () => {
    try {
      setSaving(true)
      setError("")
      const cleanSchedule = schedule.filter((d) => d.slots.length > 0)
      await DoctorsApi.update(doctorId, {
        slotDuration,
        schedule: cleanSchedule,
      } as Parameters<typeof DoctorsApi.update>[1])
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении расписания")
    } finally {
      setSaving(false)
    }
  }, [doctorId, schedule, slotDuration])

  return {
    schedule,
    slotDuration,
    setSlotDuration,
    doctorName,
    fetchLoading,
    saving,
    saved,
    error,
    scheduleMap,
    getDateEntry,
    addSlot,
    removeSlot,
    clearDate,
    setDateSlots,
    handleSave,
    today,
    maxDate,
  }
}
