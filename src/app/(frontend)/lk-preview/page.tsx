// ВРЕМЕННАЯ страница для визуальной проверки редизайна /lk без БД.
// Удаляется после проверки.
import { BackgroundDecor } from "@/components/background-decor"
import { PreviewClient } from "./preview-client"
import type { ApiAppointment } from "@/lib/api/types"
import type { User } from "@/payload-types"

const user = {
  id: 1,
  name: "Иван Петров",
  email: "ivan.petrov@example.com",
  phone: "79001234567",
} as unknown as User

function futureDate(daysAhead: number) {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}

const appointments = [
  {
    id: 101,
    doctor: { id: 5, name: "Смирнова Елена Викторовна" },
    doctorName: "Смирнова Елена Викторовна",
    specialty: "Кардиолог",
    date: futureDate(2),
    time: "14:30",
    price: 3200,
    status: "confirmed",
  },
  {
    id: 102,
    doctor: { id: 7, name: "Кузнецов Андрей Сергеевич" },
    doctorName: "Кузнецов Андрей Сергеевич",
    specialty: "Терапевт",
    date: futureDate(0),
    time: "09:00",
    price: 2500,
    status: "pending_payment",
  },
  {
    id: 103,
    doctor: { id: 9, name: "Орлова Мария Дмитриевна" },
    doctorName: "Орлова Мария Дмитриевна",
    specialty: "Невролог",
    date: "2026-07-11",
    time: "11:15",
    price: 2800,
    status: "completed",
  },
] as unknown as ApiAppointment[]

export default function LkPreviewPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <BackgroundDecor id="lk" position="fixed" />
      <PreviewClient user={user} appointments={appointments} />
    </div>
  )
}
