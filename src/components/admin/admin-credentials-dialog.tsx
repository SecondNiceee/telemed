"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { IssuedCredentials } from "./types"

/**
 * Единственное место, где пароль организации виден в открытом виде:
 * в базе лежит только хэш, повторно его не восстановить.
 */
export function AdminCredentialsDialog({
  credentials,
  onClose,
}: {
  credentials: IssuedCredentials | null
  onClose: () => void
}) {
  const [copied, setCopied] = useState<"email" | "password" | "both" | null>(null)

  const copy = async (value: string, key: "email" | "password" | "both") => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Буфер обмена может быть недоступен — пароль всё равно видно на экране.
    }
  }

  return (
    <Dialog open={Boolean(credentials)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Доступ для «{credentials?.organisationName}»</DialogTitle>
          <DialogDescription>
            Сохраните пароль сейчас — после закрытия окна его нельзя будет посмотреть, только
            сгенерировать новый.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <CredentialRow
            label="Логин"
            value={credentials?.email ?? ""}
            copied={copied === "email"}
            onCopy={() => credentials && copy(credentials.email, "email")}
          />
          <CredentialRow
            label="Пароль"
            value={credentials?.password ?? ""}
            copied={copied === "password"}
            onCopy={() => credentials && copy(credentials.password, "password")}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() =>
              credentials &&
              copy(`Логин: ${credentials.email}\nПароль: ${credentials.password}`, "both")
            }
          >
            {copied === "both" ? <Check className="size-4" /> : <Copy className="size-4" />}
            Скопировать всё
          </Button>
          <Button onClick={onClose}>Готово</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CredentialRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string
  value: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-mono text-sm text-foreground break-all">{value}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={onCopy} aria-label={`Скопировать ${label}`}>
        {copied ? <Check className="size-4 text-[var(--teal)]" /> : <Copy className="size-4" />}
      </Button>
    </div>
  )
}
