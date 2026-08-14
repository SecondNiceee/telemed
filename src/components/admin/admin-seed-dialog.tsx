"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Check, Loader2, Stethoscope, Tags } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AdminOrganisation } from "./types"

type SeedType = "categories" | "doctors"

interface SeedResult {
  type: SeedType
  created: number
  skipped: number
  failed: string[]
  total: number
}

interface AdminSeedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organisations: AdminOrganisation[]
  /** Врачи и категории попадают в общие списки — обновляем серверные данные. */
  onSeeded: () => void
}

export function AdminSeedDialog({
  open,
  onOpenChange,
  organisations,
  onSeeded,
}: AdminSeedDialogProps) {
  // Шаг «org» нужен только для врачей: поле organisation в коллекции обязательное.
  const [step, setStep] = useState<"choose" | "org">("choose")
  const [orgId, setOrgId] = useState<string | null>(null)
  const [pending, setPending] = useState<SeedType | null>(null)
  const [result, setResult] = useState<SeedResult | null>(null)

  useEffect(() => {
    if (!open) {
      setStep("choose")
      setOrgId(null)
      setPending(null)
      setResult(null)
    }
  }, [open])

  const run = async (type: SeedType, organisationId?: string) => {
    setPending(type)
    setResult(null)
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, organisationId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Не удалось создать тестовые данные")

      setResult(data as SeedResult)
      onSeeded()

      const label = type === "categories" ? "Категории" : "Врачи"
      if (data.created > 0) toast.success(`${label}: создано ${data.created}`)
      else toast.info(`${label}: всё уже создано ранее`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать тестовые данные")
    } finally {
      setPending(null)
    }
  }

  const startDoctors = () => {
    if (organisations.length === 0) {
      toast.error("Сначала создайте организацию — врача не к кому привязать")
      return
    }
    // Организацию выбираем всегда — даже когда она одна. Иначе непонятно, к
    // какой поликлинике привязались врачи.
    setStep("org")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {step === "org" ? "Организация для врачей" : "Тестовые данные"}
          </DialogTitle>
          <DialogDescription>
            {step === "org"
              ? "Пять демо-врачей будут привязаны к выбранной организации."
              : "Заполняет базу демо-контентом. Уже существующие записи не перезаписываются."}
          </DialogDescription>
        </DialogHeader>

        {step === "choose" ? (
          <div className="flex flex-col gap-3">
            <SeedOption
              icon={<Tags className="size-5" aria-hidden="true" />}
              title="Категории"
              description="10 специальностей с описаниями и иконками"
              busy={pending === "categories"}
              disabled={pending !== null}
              onClick={() => run("categories")}
            />
            <SeedOption
              icon={<Stethoscope className="size-5" aria-hidden="true" />}
              title="Врачи"
              description="5 врачей с фото, услугами и образованием"
              busy={pending === "doctors"}
              disabled={pending !== null}
              onClick={startDoctors}
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {organisations.map((org) => (
              <li key={org.id}>
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => {
                    setOrgId(String(org.id))
                    void run("doctors", String(org.id))
                  }}
                  className="w-full rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-[var(--teal)] disabled:opacity-60"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-medium text-card-foreground truncate">
                        {org.name}
                      </span>
                      <span className="block text-xs font-mono text-muted-foreground truncate">
                        {org.email}
                      </span>
                    </span>
                    {pending === "doctors" && orgId === String(org.id) && (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {result && (
          <div
            role="status"
            className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground"
          >
            <p className="flex items-center gap-2 font-medium">
              <Check className="size-4 text-[var(--teal)]" aria-hidden="true" />
              {result.type === "categories" ? "Категории" : "Врачи"} — готово
            </p>
            <p className="mt-1 text-muted-foreground">
              Создано: {result.created} · Пропущено: {result.skipped} из {result.total}
            </p>
            {result.failed.length > 0 && (
              <p className="mt-1 text-destructive">С ошибкой: {result.failed.join(", ")}</p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "org" && (
            <Button
              type="button"
              variant="outline"
              disabled={pending !== null}
              onClick={() => setStep("choose")}
            >
              <ArrowLeft className="size-4" />
              Назад
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SeedOption({
  icon,
  title,
  description,
  busy,
  disabled,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  busy: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-4 text-left transition-colors hover:border-[var(--teal)] disabled:opacity-60"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-[var(--teal)]">
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-card-foreground">{title}</span>
        <span className="block text-sm text-muted-foreground text-pretty">{description}</span>
      </span>
    </button>
  )
}
