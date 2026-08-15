"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ArrowLeft, Check, Loader2, Stethoscope, Tags, Users } from "lucide-react"
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

type SeedType = "categories" | "doctors" | "doctors-bulk"

interface SeedResult {
  type: SeedType
  created: number
  skipped: number
  failed: string[]
  total: number
}

interface SeedCategory {
  id: number | string
  name: string
  slug: string
}

const TYPE_LABELS: Record<SeedType, string> = {
  categories: "Категории",
  doctors: "Врачи",
  "doctors-bulk": "20 врачей в категорию",
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
  // Шаг «category» — только для массового сида: 20 врачей вешаются на одну категорию.
  const [step, setStep] = useState<"choose" | "org" | "category">("choose")
  /** Какой из двух сидов врачей запускаем после выбора организации. */
  const [flow, setFlow] = useState<"doctors" | "doctors-bulk">("doctors")
  const [orgId, setOrgId] = useState<string | null>(null)
  const [pending, setPending] = useState<SeedType | null>(null)
  const [result, setResult] = useState<SeedResult | null>(null)
  const [categories, setCategories] = useState<SeedCategory[] | null>(null)
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setStep("choose")
      setFlow("doctors")
      setOrgId(null)
      setPending(null)
      setResult(null)
      setActiveCategoryId(null)
      // Список категорий тоже сбрасываем: иначе после закрытия диалога здесь
      // остаётся устаревший (или недогруженный) стейт загрузки.
      setCategories(null)
      setCategoriesLoading(false)
    }
  }, [open])

  /**
   * Категории тянем один раз при первом входе на шаг выбора категории.
   *
   * В зависимостях НЕ должно быть categoriesLoading: этот флаг меняется внутри
   * самого эффекта, эффект перезапускался, cleanup выставлял cancelled = true и
   * результат уже летящего запроса выбрасывался — спиннер «Загружаем категории…»
   * висел вечно, без ошибок ни в браузере, ни на сервере.
   */
  useEffect(() => {
    if (step !== "category" || categories !== null) return

    const controller = new AbortController()
    setCategoriesLoading(true)

    void (async () => {
      try {
        const res = await fetch("/api/doctor-categories?limit=100&sort=name", {
          credentials: "include",
          signal: controller.signal,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.message || "Не удалось загрузить категории")

        setCategories(
          ((data?.docs ?? []) as SeedCategory[]).map((doc) => ({
            id: doc.id,
            name: doc.name,
            slug: doc.slug,
          })),
        )
      } catch (err) {
        if (controller.signal.aborted) return
        console.error("[admin:seed] failed to load categories", err)
        setCategories([])
        toast.error(err instanceof Error ? err.message : "Не удалось загрузить категории")
      } finally {
        if (!controller.signal.aborted) setCategoriesLoading(false)
      }
    })()

    return () => {
      controller.abort()
    }
  }, [step, categories])

  const run = async (
    type: SeedType,
    options?: { organisationId?: string; categoryId?: string },
  ) => {
    setPending(type)
    setResult(null)
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, ...options }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Не удалось создать тестовые данные")

      setResult(data as SeedResult)
      onSeeded()

      const label = TYPE_LABELS[type]
      if (data.created > 0) toast.success(`${label}: создано ${data.created}`)
      else toast.info(`${label}: всё уже создано ранее`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать тестовые данные")
    } finally {
      setPending(null)
    }
  }

  const startDoctors = (nextFlow: "doctors" | "doctors-bulk") => {
    if (organisations.length === 0) {
      toast.error("Сначала создайте организацию — врача не к кому привязать")
      return
    }
    setFlow(nextFlow)
    setResult(null)
    // Организацию выбираем всегда — даже когда она одна. Иначе непонятно, к
    // какой поликлинике привязались врачи.
    setStep("org")
  }

  const title =
    step === "org"
      ? "Организация для врачей"
      : step === "category"
        ? "Категория для 20 врачей"
        : "Тестовые данные"

  const description =
    step === "org"
      ? flow === "doctors-bulk"
        ? "Двадцать демо-врачей будут привязаны к выбранной организации."
        : "Пять демо-врачей будут привязаны к выбранной организации."
      : step === "category"
        ? "Все 20 врачей получат одну эту специальность — удобно для проверки длинного списка на странице категории."
        : "Заполняет базу демо-контентом. Уже существующие записи не перезаписываются."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === "choose" && (
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
              onClick={() => startDoctors("doctors")}
            />
            <SeedOption
              icon={<Users className="size-5" aria-hidden="true" />}
              title="Создать 20 врачей на 1 категорию"
              description="Отдельный набор из 20 врачей с собственными фото — все в одной выбранной специальности"
              busy={pending === "doctors-bulk"}
              disabled={pending !== null}
              onClick={() => startDoctors("doctors-bulk")}
            />
          </div>
        )}

        {step === "org" && (
          <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {organisations.map((org) => (
              <li key={org.id}>
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => {
                    setOrgId(String(org.id))
                    // Для массового сида нужна ещё и категория — уходим на второй шаг.
                    if (flow === "doctors-bulk") setStep("category")
                    else void run("doctors", { organisationId: String(org.id) })
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
                      <Loader2
                        className="size-4 animate-spin text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {step === "category" && (
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {categoriesLoading && categories === null && (
              <p className="flex items-center gap-2 px-1 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Загружаем категории…
              </p>
            )}
            {categories !== null && categories.length === 0 && !categoriesLoading && (
              <p className="px-1 py-3 text-sm text-muted-foreground text-pretty">
                Категорий пока нет. Вернитесь назад и сначала создайте тестовые категории.
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {(categories ?? []).map((category) => (
                <li key={category.id}>
                  <button
                    type="button"
                    disabled={pending !== null}
                    onClick={() => {
                      setActiveCategoryId(String(category.id))
                      void run("doctors-bulk", {
                        organisationId: orgId ?? undefined,
                        categoryId: String(category.id),
                      })
                    }}
                    className="w-full rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-[var(--teal)] disabled:opacity-60"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block font-medium text-card-foreground truncate">
                          {category.name}
                        </span>
                        <span className="block text-xs font-mono text-muted-foreground truncate">
                          /category/{category.slug}
                        </span>
                      </span>
                      {pending === "doctors-bulk" &&
                        activeCategoryId === String(category.id) && (
                          <Loader2
                            className="size-4 animate-spin text-muted-foreground"
                            aria-hidden="true"
                          />
                        )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result && (
          <div
            role="status"
            className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground"
          >
            <p className="flex items-center gap-2 font-medium">
              <Check className="size-4 text-[var(--teal)]" aria-hidden="true" />
              {TYPE_LABELS[result.type]} — готово
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
          {step !== "choose" && (
            <Button
              type="button"
              variant="outline"
              disabled={pending !== null}
              onClick={() => setStep(step === "category" ? "org" : "choose")}
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
