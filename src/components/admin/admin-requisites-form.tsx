"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowUpRight, Check, CircleAlert, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export interface RequisitesFormValues {
  legalName: string
  inn: string
  ogrn: string
  address: string
  email: string
  phone: string
  hostingLocation: string
  rknNotificationSubmitted: boolean
}

type TextField = Exclude<keyof RequisitesFormValues, "rknNotificationSubmitted">

/**
 * Обязательные для снятия пометки «документ не заполнен» — совпадает со
 * списком в hasUnfilledRequisites(): если поле есть там, оно должно быть и
 * здесь, иначе админ заполнит «всё» и удивится, что пометка не пропала.
 */
const REQUIRED_FIELDS: TextField[] = [
  "legalName",
  "inn",
  "ogrn",
  "address",
  "email",
  "phone",
  "hostingLocation",
]

const LEGAL_PAGES = [
  { href: "/legal/privacy", label: "Политика конфиденциальности" },
  { href: "/legal/offer", label: "Публичная оферта" },
  { href: "/legal/consent", label: "Согласие на обработку ПДн" },
]

export function AdminRequisitesForm({ initialValues }: { initialValues: RequisitesFormValues }) {
  const router = useRouter()
  const [values, setValues] = useState(initialValues)
  const [saving, setSaving] = useState(false)

  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues)
  const missing = REQUIRED_FIELDS.filter((field) => values[field].trim() === "")
  const savedMissing = REQUIRED_FIELDS.filter((field) => initialValues[field].trim() === "")

  const update = (field: TextField, value: string) =>
    setValues((prev) => ({ ...prev, [field]: value }))

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/admin/requisites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Не удалось сохранить реквизиты")
      toast.success("Реквизиты сохранены. Документы обновлены.")
      // initialValues приходят из RSC — обновляем, чтобы isDirty и статус
      // «заполнено» пересчитались от сохранённого состояния.
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить реквизиты")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Реквизиты оператора
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
            Юрлицо платформы, которое подставляется в Политику, Оферту и Согласие. Данные
            должны совпадать с ЕГРЮЛ — документ с неточным наименованием оператора не
            защищает.
          </p>
        </div>
        <StatusBadge missingCount={savedMissing.length} />
      </div>

      <fieldset className="flex flex-col gap-6">
        <legend className="text-xs font-medium uppercase tracking-widest text-[var(--teal)]">
          Юридическое лицо
        </legend>
        <Field
          id="legalName"
          label="Полное наименование"
          hint="Как в ЕГРЮЛ, включая организационно-правовую форму"
          value={values.legalName}
          onChange={(v) => update("legalName", v)}
          placeholder="ООО «Смарткардио»"
          autoComplete="organization"
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            id="inn"
            label="ИНН"
            value={values.inn}
            onChange={(v) => update("inn", v.replace(/\D/g, ""))}
            placeholder="10 цифр"
            inputMode="numeric"
            className="font-mono"
          />
          <Field
            id="ogrn"
            label="ОГРН"
            value={values.ogrn}
            onChange={(v) => update("ogrn", v.replace(/\D/g, ""))}
            placeholder="13 цифр"
            inputMode="numeric"
            className="font-mono"
          />
        </div>
        <TextareaField
          id="address"
          label="Юридический адрес"
          value={values.address}
          onChange={(v) => update("address", v)}
          placeholder="101000, г. Москва, ул. …, д. …, офис …"
        />
      </fieldset>

      <fieldset className="flex flex-col gap-6">
        <legend className="text-xs font-medium uppercase tracking-widest text-[var(--teal)]">
          Контакты для обращений
        </legend>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            id="email"
            label="Email"
            hint="Сюда пишут по персональным данным и возвратам"
            value={values.email}
            onChange={(v) => update("email", v)}
            placeholder="privacy@smartcardio.ru"
            type="email"
            autoComplete="email"
          />
          <Field
            id="phone"
            label="Телефон"
            value={values.phone}
            onChange={(v) => update("phone", v)}
            placeholder="+7 (495) 000-00-00"
            type="tel"
            autoComplete="tel"
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-6">
        <legend className="text-xs font-medium uppercase tracking-widest text-[var(--teal)]">
          Персональные данные
        </legend>
        <Field
          id="hostingLocation"
          label="Где размещены серверы с базой"
          hint="Для граждан РФ база должна находиться в России (ч. 5 ст. 18 152-ФЗ). Страна, город, провайдер."
          value={values.hostingLocation}
          onChange={(v) => update("hostingLocation", v)}
          placeholder="Россия, Москва, дата-центр …"
        />
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={values.rknNotificationSubmitted}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, rknNotificationSubmitted: e.target.checked }))
            }
            className="mt-0.5 size-4 shrink-0 rounded border-input accent-[var(--teal)]"
          />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              Уведомление в Роскомнадзор подано
            </span>
            <span className="text-xs leading-relaxed text-muted-foreground text-pretty">
              Памятка для себя, в документы не попадает. Для данных о здоровье уведомление
              обязательно (ст. 22 152-ФЗ).
            </span>
          </span>
        </label>
      </fieldset>

      <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-card-foreground">Где это появится</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {LEGAL_PAGES.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/40"
                >
                  {page.label}
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <Button type="submit" disabled={saving || !isDirty} className="shrink-0">
          <Save className="size-4" />
          {saving ? "Сохраняем…" : "Сохранить"}
        </Button>
      </div>

      {missing.length > 0 && isDirty && (
        <p className="-mt-6 text-xs text-muted-foreground">
          Можно сохранить частично: пока не заполнены все поля, документы будут помечены как
          черновик.
        </p>
      )}
    </form>
  )
}

/** Заполнено всё или нет — то же условие, по которому документы ставят пометку. */
function StatusBadge({ missingCount }: { missingCount: number }) {
  const complete = missingCount === 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        complete
          ? "bg-[var(--teal)]/10 text-[var(--teal)]"
          : "bg-destructive/10 text-destructive",
      )}
    >
      {complete ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <CircleAlert className="size-3.5" aria-hidden="true" />
      )}
      {complete
        ? "Документы опубликованы"
        : `Документы в черновике · не заполнено: ${missingCount}`}
    </span>
  )
}

interface FieldProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  id: string
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
}

function Field({ id, label, hint, value, onChange, className, ...props }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
        {...props}
      />
      {hint && <p className="text-xs leading-relaxed text-muted-foreground text-pretty">{hint}</p>}
    </div>
  )
}

function TextareaField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="placeholder:text-muted-foreground border-input flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base font-medium text-foreground shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm resize-none"
      />
    </div>
  )
}
