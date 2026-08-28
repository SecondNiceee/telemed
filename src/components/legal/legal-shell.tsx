import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { documentsDateLabel } from '@/lib/legal/operator'

interface LegalShellProps {
  title: string
  /** Короткое пояснение под заголовком - зачем документ и к кому относится. */
  lead: string
  /**
   * Версия ЭТОГО документа в формате YYYY-MM-DD.
   *
   * Обязательна для документов, чья версия сохраняется у пользователя (оферта,
   * согласие): дата в шапке должна совпадать с сохранённой, иначе непонятно,
   * какую редакцию человек принял. Если не передана - берётся общая дата
   * документов, этого достаточно для страниц без собственной версии.
   */
  version?: string
  /**
   * Показать предупреждение о незаполненных реквизитах оператора.
   *
   * Приходит пропом, а не вычисляется внутри: реквизиты теперь лежат в БД, а
   * читать их каркас не может - он рендерится и на страницах без реквизитов
   * (реестр клиник). Флаг считает та страница, которая эти реквизиты печатает,
   * из того же значения, что подставлено в текст.
   */
  requisitesUnfilled?: boolean
  children: ReactNode
}

/**
 * Общий каркас юридических страниц: заголовок, дата редакции и предупреждение о
 * незаполненных реквизитах.
 *
 * Предупреждение видно посетителю намеренно. Документ без наименования оператора
 * не выполняет требование ст. 18.1 152-ФЗ, и честная пометка «черновик» лучше
 * официального вида с «___» вместо названия организации.
 */
export function LegalShell({
  title,
  lead,
  version,
  requisitesUnfilled = false,
  children,
}: LegalShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
          <header className="flex flex-col gap-3 border-b pb-8">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Редакция от {documentsDateLabel(version)}
            </p>
            <h1 className="text-balance text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            <p className="text-pretty leading-relaxed text-muted-foreground">{lead}</p>
          </header>

          {requisitesUnfilled ? (
            <div
              className="mt-8 flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-medium text-foreground">Документ не заполнен и не вступил в силу</p>
                <p className="text-pretty leading-relaxed text-muted-foreground">
                  В тексте не указаны реквизиты оператора персональных данных. До их
                  заполнения документ является черновиком и не может считаться
                  опубликованной политикой. Реквизиты заполняются администратором в
                  настройках сайта.
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-10 flex flex-col gap-10">{children}</div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
