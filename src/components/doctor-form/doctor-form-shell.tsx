"use client"

import React from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { AlertCircle, ArrowLeft, CheckCircle, X } from "lucide-react"

interface DoctorFormShellProps {
  /** Иконка в шапке карточки: UserPlus при создании, Save при редактировании. */
  icon: LucideIcon
  title: string
  subtitle: string
  success: string | null
  error: string | null
  onDismissSuccess: () => void
  onDismissError: () => void
  children: React.ReactNode
}

/**
 * Обёртка экрана врача: возврат в кабинет, карточка с шапкой и плашки
 * успеха/ошибки. Отличаются между create и edit только иконка и две строки
 * текста, поэтому они приходят пропсами, а вся разметка живёт здесь.
 */
export function DoctorFormShell({
  icon: Icon,
  title,
  subtitle,
  success,
  error,
  onDismissSuccess,
  onDismissError,
  children,
}: DoctorFormShellProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <Link
        href="/lk-org"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад к кабинету
      </Link>

      {/* Form card */}
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        {/* Success message */}
        {success && (
          <div className="flex items-center gap-3 rounded-lg bg-teal/10 border border-teal/25 p-4 mb-6">
            <CheckCircle className="w-5 h-5 text-teal shrink-0" />
            <p className="text-sm text-teal font-medium">{success}</p>
            <button
              type="button"
              onClick={onDismissSuccess}
              className="ml-auto p-1 rounded hover:bg-teal/10 transition-colors"
            >
              <X className="w-4 h-4 text-teal" />
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-3 rounded-lg bg-destructive/10 border border-destructive/20 p-4 mb-6">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive font-medium">{error}</p>
            <button
              type="button"
              onClick={onDismissError}
              className="ml-auto p-1 rounded hover:bg-destructive/10 transition-colors"
            >
              <X className="w-4 h-4 text-destructive" />
            </button>
          </div>
        )}

        {children}
      </div>
    </div>
  )
}
