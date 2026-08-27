"use client"

import { useMemo, useState } from "react"
import { Loader2, ScrollText, Check, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { OrgAuthApi, type OrganisationRequisites } from "@/lib/api/org-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * Реквизиты организации в её собственном кабинете.
 *
 * Клиника заполняет их сама, и это не вопрос удобства: по данным о здоровье
 * оператор - она, а согласие пациента обязано называть конкретного оператора
 * (п. 3 ч. 4 ст. 9 152-ФЗ). Заполнять эти поля за клинику нельзя - ошибка
 * попадёт в юридический документ как её собственное заявление.
 *
 * Отсюда же следует, что незаполненные реквизиты нужно показывать явно, а не
 * прятать: пока их нет, пациент не видит, кто отвечает за его данные.
 */

interface OrgLegalRequisitesProps {
  orgId: number
  initial: OrganisationRequisites
}

const FIELDS: {
  key: keyof OrganisationRequisites
  label: string
  hint?: string
  type?: string
  placeholder?: string
}[] = [
  {
    key: "legalName",
    label: "Полное наименование юридического лица",
    hint: "Как в ЕГРЮЛ. Это наименование пациент увидит в согласии как оператора своих медицинских данных.",
    placeholder: 'ООО «Название»',
  },
  { key: "inn", label: "ИНН", placeholder: "0000000000" },
  { key: "ogrn", label: "ОГРН", placeholder: "0000000000000" },
  {
    key: "legalAddress",
    label: "Юридический адрес",
    placeholder: "город, улица, дом",
  },
  {
    key: "privacyEmail",
    label: "Адрес для обращений по персональным данным",
    hint: "Сюда пациент направит отзыв согласия или требование удалить данные о здоровье.",
    type: "email",
    placeholder: "privacy@example.ru",
  },
  {
    key: "licenceNumber",
    label: "Номер лицензии на медицинскую деятельность",
    hint: "Медицинскую услугу оказываете вы по своей лицензии, платформа даёт только техническую возможность.",
    placeholder: "Л041-00000-00/00000000",
  },
  { key: "licenceIssuedBy", label: "Кем выдана лицензия" },
  { key: "licenceIssuedAt", label: "Дата выдачи лицензии", type: "date" },
]

function toFormState(initial: OrganisationRequisites): Record<string, string> {
  const state: Record<string, string> = {}
  for (const { key, type } of FIELDS) {
    const value = initial[key]
    // Дата приходит в ISO, а input[type=date] принимает только YYYY-MM-DD
    state[key] = type === "date" && value ? String(value).slice(0, 10) : (value ?? "")
  }
  return state
}

export function OrgLegalRequisites({ orgId, initial }: OrgLegalRequisitesProps) {
  const [form, setForm] = useState<Record<string, string>>(() => toFormState(initial))
  const [saved, setSaved] = useState<Record<string, string>>(() => toFormState(initial))
  const [isSaving, setIsSaving] = useState(false)

  const missing = useMemo(
    () => FIELDS.filter(({ key }) => !saved[key]?.trim()).map(({ label }) => label),
    [saved],
  )

  const isDirty = useMemo(
    () => FIELDS.some(({ key }) => (form[key] ?? "").trim() !== (saved[key] ?? "").trim()),
    [form, saved],
  )

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const payload: Record<string, string | null> = {}
      for (const { key } of FIELDS) {
        const value = (form[key] ?? "").trim()
        // Пустое поле сохраняем как null, а не как "": в БД это «не заполнено»,
        // и реестр должен показать пропуск, а не пустую строку.
        payload[key] = value === "" ? null : value
      }

      await OrgAuthApi.update(orgId, payload as Partial<OrganisationRequisites>)
      setSaved({ ...form })
      toast.success("Реквизиты сохранены")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить реквизиты")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <ScrollText className="size-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Юридические реквизиты</h2>
          <p className="text-xs text-muted-foreground">
            Подставляются в согласие пациента и в реестр организаций на сайте
          </p>
        </div>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        По данным о здоровье ваших пациентов оператор персональных данных &mdash; ваша
        организация, платформа обрабатывает их по вашему поручению. Поэтому согласие
        пациента должно называть вас, и заполнить эти сведения можете только вы.
      </p>

      {missing.length > 0 && (
        <div
          role="status"
          className="mb-4 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <div className="text-sm text-foreground">
            <p className="font-medium">Не заполнено: {missing.length}</p>
            <p className="mt-1 text-muted-foreground">
              Пока сведения не заполнены, пациент не видит, кто отвечает за его медицинские
              данные: {missing.join(", ").toLowerCase()}.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {FIELDS.map(({ key, label, hint, type, placeholder }) => {
          const inputId = `org-req-${key}`
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={inputId}>{label}</Label>
              <Input
                id={inputId}
                type={type ?? "text"}
                placeholder={placeholder}
                value={form[key] ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                disabled={isSaving}
                aria-describedby={hint ? `${inputId}-hint` : undefined}
              />
              {hint && (
                <p id={`${inputId}-hint`} className="text-xs leading-relaxed text-muted-foreground">
                  {hint}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={handleSave} disabled={isSaving || !isDirty} className="gap-2">
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-4" aria-hidden="true" />
          )}
          Сохранить реквизиты
        </Button>
        {!isDirty && !isSaving && (
          <p className="text-xs text-muted-foreground">Изменений нет</p>
        )}
      </div>
    </section>
  )
}
