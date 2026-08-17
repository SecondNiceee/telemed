"use client"

import { useState } from "react"
import { Phone, Loader2, Pencil, Check, X } from "lucide-react"
import { toast } from "sonner"
import { OrgAuthApi } from "@/lib/api/org-auth"
import { useOrgStore } from "@/stores/org-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface OrgSupportPhoneProps {
  orgId: number
  initialSupportPhone: string
}

export function OrgSupportPhone({ orgId, initialSupportPhone }: OrgSupportPhoneProps) {
  const { setOrg, org } = useOrgStore()
  const [phone, setPhone] = useState(initialSupportPhone)
  const [draft, setDraft] = useState(initialSupportPhone)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const startEditing = () => {
    setDraft(phone)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setDraft(phone)
    setIsEditing(false)
  }

  const handleSave = async () => {
    const trimmed = draft.trim()
    setIsSaving(true)
    try {
      const updated = await OrgAuthApi.update(orgId, { supportPhone: trimmed })
      const nextPhone = updated.supportPhone ?? ""
      setPhone(nextPhone)
      setIsEditing(false)
      // Keep the global store in sync if the org is loaded there
      if (org) setOrg({ ...org, supportPhone: nextPhone })
      toast.success("Телефон поддержки обновлён")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить телефон")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Phone className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Телефон поддержки</p>
          <p className="text-xs text-muted-foreground">
            Контактный номер для пациентов вашей организации
          </p>
        </div>
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-support-phone" className="sr-only">
              Телефон поддержки
            </Label>
            <Input
              id="org-support-phone"
              type="tel"
              inputMode="tel"
              placeholder="+7 (900) 000-00-00"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving} className="gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Сохранить
            </Button>
            <Button variant="outline" onClick={cancelEditing} disabled={isSaving} className="gap-2">
              <X className="w-4 h-4" />
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4">
          <p className="text-base font-medium text-foreground">
            {phone ? phone : <span className="text-muted-foreground">Не указан</span>}
          </p>
          <Button variant="outline" size="sm" onClick={startEditing} className="gap-2 shrink-0">
            <Pencil className="w-4 h-4" />
            {phone ? "Изменить" : "Добавить"}
          </Button>
        </div>
      )}
    </div>
  )
}
