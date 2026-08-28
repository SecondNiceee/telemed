"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type RevocationStatus = "none" | "requested" | "revoked"

interface RevokeConsentCardProps {
  status?: RevocationStatus | null
  requestedAt?: string | null
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return value
  }
}

/**
 * Отзыв согласия на обработку персональных данных.
 *
 * Почему блок оформлен тихо, без предупреждающих цветов и иконок: право отозвать
 * согласие - обычное право пациента, а не аварийная ситуация. Красная рамка
 * вокруг всего блока читалась бы как «сюда лучше не заходить», то есть
 * подталкивала бы отказаться от использования права. Заметным здесь делается
 * только последствие - в тексте подтверждения.
 *
 * Почему подтверждение перечисляет последствия по пунктам: между «отозвать
 * согласие» и «удалить записи консультаций и переписку» для пациента нет
 * очевидной связи, и узнать о ней после нажатия было бы поздно.
 */
export function RevokeConsentCard({ status, requestedAt }: RevokeConsentCardProps) {
  const [submitting, setSubmitting] = useState(false)
  const [localStatus, setLocalStatus] = useState<RevocationStatus>(status ?? "none")
  const [localRequestedAt, setLocalRequestedAt] = useState<string | null>(requestedAt ?? null)

  const submit = async () => {
    setSubmitting(true)

    try {
      const res = await fetch("/api/account/revoke-consent", { method: "POST" })
      const data = (await res.json()) as {
        status?: RevocationStatus
        requestedAt?: string | null
        message?: string
        error?: string
      }

      if (!res.ok) {
        toast.error(data.error ?? "Не удалось отправить заявку")
        return
      }

      setLocalStatus(data.status ?? "requested")
      setLocalRequestedAt(data.requestedAt ?? null)
      toast.success(data.message ?? "Заявка принята")
    } catch {
      toast.error("Нет связи с сервером. Попробуйте позже.")
    } finally {
      setSubmitting(false)
    }
  }

  // Аккаунт уже обезличен. Строго говоря, увидеть это состояние пациент не
  // может - войти в обезличенный аккаунт нельзя. Ветка оставлена как защита от
  // пустого блока, если страница отрендерится по кэшированной сессии.
  if (localStatus === "revoked") {
    return (
      <section className="rounded-2xl bg-card px-5 py-4 shadow-[0_0_0_1px_oklch(0_0_0_/_0.07)]">
        <h2 className="text-[15px] font-semibold text-foreground">Согласие отозвано</h2>
        <p className="mt-1.5 text-pretty text-[13px] leading-relaxed text-muted-foreground">
          Обработка ваших персональных данных прекращена, данные обезличены.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-card px-5 py-4 shadow-[0_0_0_1px_oklch(0_0_0_/_0.07)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Персональные данные
      </p>
      <h2 className="mt-1 text-[15px] font-semibold text-foreground">
        Отзыв согласия на обработку
      </h2>

      {localStatus === "requested" ? (
        <p className="mt-2 text-pretty text-[13px] leading-relaxed text-muted-foreground">
          Заявка принята
          {localRequestedAt ? ` ${formatDate(localRequestedAt)}` : ""} и находится на рассмотрении.
          Мы свяжемся с вами по итогам.
        </p>
      ) : (
        <>
          <p className="mt-2 text-pretty text-[13px] leading-relaxed text-muted-foreground">
            Вы можете в любой момент отозвать согласие на обработку персональных данных. После
            исполнения ваши данные будут обезличены, а доступ в кабинет прекращён.
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 rounded-full px-5 text-destructive hover:text-destructive"
              >
                Отозвать согласие
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent className="max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>Отозвать согласие на обработку данных?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 text-left">
                    <p>После исполнения заявки:</p>
                    <ul className="list-disc space-y-1.5 pl-5">
                      <li>имя, телефон и email будут удалены из профиля;</li>
                      <li>
                        видеозаписи консультаций и переписка с врачом будут удалены безвозвратно;
                      </li>
                      <li>предстоящие и неоплаченные записи на приём будут отменены;</li>
                      <li>вход в личный кабинет станет невозможен.</li>
                    </ul>
                    <p>
                      Сведения об оплатах сохранятся без ваших личных данных — они нужны для
                      бухгалтерского и налогового учёта.
                    </p>
                    <p className="font-medium text-foreground">Отменить исполнение нельзя.</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel>Не отзывать</AlertDialogCancel>
                <AlertDialogAction
                  onClick={submit}
                  disabled={submitting}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {submitting ? "Отправляем…" : "Отозвать согласие"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </section>
  )
}
