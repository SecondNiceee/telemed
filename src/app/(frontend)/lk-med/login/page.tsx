import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionFromCookie } from "@/lib/auth/getSessionFromCookie"
import type { ApiDoctor } from "@/lib/api/types"
import { DoctorLoginForm } from "@/components/doctor-login-form"

export const metadata = {
  title: "Вход для врачей | smartcardio",
  description: "Авторизация в личном кабинете врача на платформе smartcardio Телемедицина",
}

export const dynamic = "force-dynamic"

export default async function LkMedLoginPage() {
  const requestHeaders = await headers()

  // If already authenticated, redirect to dashboard
  const doctor = await getSessionFromCookie<ApiDoctor>(
    requestHeaders,
    'doctors-token',
    'doctors',
  )

  if (doctor) {
    redirect("/lk-med")
  }

  return <DoctorLoginForm />
}
