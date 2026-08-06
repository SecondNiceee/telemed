import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, User, Calendar, Clock, CheckCircle, Video } from "lucide-react"
import { Footer } from "@/components/footer"
import { DoctorsApi } from "@/lib/api/doctors"
import { AppointmentsApi } from "@/lib/api/appointments"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"
import { resolveImageUrl } from "@/lib/utils/image"
import { formatDate, getStatusLabel, getStatusColor } from "@/lib/utils/date"
import type { Media } from "@/payload-types"

export const metadata = {
  title: "Консультации врача | smartcardio",
  description: "Просмотр консультаций врача в кабинете организации",
}

interface DoctorDashboardPageProps {
  params: Promise<{ id: string }>
}

export default async function DoctorDashboardPage({ params }: DoctorDashboardPageProps) {
  const { id } = await params
  const doctorId = parseInt(id, 10)
  
  if (isNaN(doctorId)) {
    notFound()
  }

  const requestHeaders = await headers()
  const cookie = requestHeaders.get("cookie") ?? ""

  const org = await getSessionFromCookie<{ id: number; name?: string; email: string }>(
    requestHeaders,
    'organisations-token',
    'organisations',
  )

  if (!org) {
    redirect("/lk-org")
  }

  // Fetch doctor and verify ownership
  const doctor = await DoctorsApi.fetchById(doctorId)
  
  if (!doctor) {
    notFound()
  }

  // Check if doctor belongs to this organisation
  const orgId = typeof doctor.organisation === 'object' && doctor.organisation 
    ? doctor.organisation.id 
    : doctor.organisation
  
  if (orgId !== org.id) {
    redirect("/lk-org")
  }

  // Fetch appointments for this doctor
  const appointments = await AppointmentsApi.fetchByDoctorServer(doctorId, { cookie })

  const now = new Date()
  const upcoming = appointments.filter(a => {
    if (a.status === 'cancelled' || a.status === 'completed') return false
    const apptDate = new Date(`${a.date}T${a.time}`)
    return apptDate >= now
  }).sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time}`)
    const dateB = new Date(`${b.date}T${b.time}`)
    return dateA.getTime() - dateB.getTime()
  })

  const past = appointments.filter(a => {
    if (a.status === 'cancelled') return false
    if (a.status === 'completed') return true
    const apptDate = new Date(`${a.date}T${a.time}`)
    return apptDate < now
  }).sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time}`)
    const dateB = new Date(`${b.date}T${b.time}`)
    return dateB.getTime() - dateA.getTime()
  })

  const specialty = DoctorsApi.getSpecialty(doctor)
  
  // Calculate stats
  const total = appointments.filter(a => a.status !== 'cancelled').length
  const active = appointments.filter(a => a.status === 'in_progress').length

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back button and header */}
          <div className="mb-6">
            <Link 
              href="/lk-org" 
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Назад к списку врачей
            </Link>
            
            {/* Doctor info */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-muted shrink-0">
                {doctor.photo ? (
                  <img
                    src={resolveImageUrl((doctor.photo as Media).url)}
                    alt={doctor.name || "Врач"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {doctor.name || "Без имени"}
                </h1>
                <p className="text-muted-foreground">{specialty}</p>
              </div>
            </div>
          </div>

          {/* Stats Cards - 2 columns like on /lk-org */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{total}</p>
                  <p className="text-xs text-muted-foreground">Всего консультаций</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <Video className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{active}</p>
                  <p className="text-xs text-muted-foreground">Текущих</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{upcoming.length}</p>
                  <p className="text-xs text-muted-foreground">Предстоящих</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{past.length}</p>
                  <p className="text-xs text-muted-foreground">Прошедших</p>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming appointments */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Предстоящие консультации
            </h2>
            {upcoming.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-muted-foreground">Нет предстоящих консультаций</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {upcoming.map((appt) => {
                  const userName = typeof appt.user === 'object' && appt.user 
                    ? appt.user.name || appt.user.email 
                    : appt.userName || 'Пациент'
                  return (
                    <Link
                      key={appt.id}
                      href={`/lk-org/consultation?id=${appt.id}`}
                      className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{userName}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(appt.date)} в {appt.time}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(appt.status)}`}>
                          {getStatusLabel(appt.status)}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Past appointments */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Прошедшие консультации
            </h2>
            {past.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-muted-foreground">Нет прошедших консультаций</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {past.map((appt) => {
                  const userName = typeof appt.user === 'object' && appt.user 
                    ? appt.user.name || appt.user.email 
                    : appt.userName || 'Пациент'
                  return (
                    <Link
                      key={appt.id}
                      href={`/lk-org/consultation?id=${appt.id}`}
                      className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{userName}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(appt.date)} в {appt.time}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(appt.status)}`}>
                          {getStatusLabel(appt.status)}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
