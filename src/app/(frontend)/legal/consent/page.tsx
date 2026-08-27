import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell } from '@/components/legal/legal-shell'
import { hasUnfilledRequisites } from '@/lib/legal/operator'
import { PDN_CONSENT_TITLE, pdnConsentClauses } from '@/lib/legal/pdn-consent'

export const metadata: Metadata = {
  title: `${PDN_CONSENT_TITLE} — smartcardio`,
  description:
    'Текст согласия на обработку персональных данных, включая данные о состоянии здоровья, которое даётся при регистрации в сервисе smartcardio.',
  robots: hasUnfilledRequisites() ? { index: false, follow: false } : undefined,
}

export default function PdnConsentPage() {
  const clauses = pdnConsentClauses()

  return (
    <LegalShell
      title={PDN_CONSENT_TITLE}
      lead="Текст согласия, которое пользователь даёт при регистрации в сервисе. Согласие на запись консультации запрашивается отдельно — перед началом каждой консультации."
    >
      <div className="flex flex-col gap-8">
        {clauses.map((clause, index) => (
          <section key={index} className="flex flex-col gap-3">
            {clause.title ? (
              <h2 className="text-lg font-semibold leading-snug text-foreground">{clause.title}</h2>
            ) : null}

            {clause.text ? (
              <p className="text-pretty leading-relaxed text-muted-foreground">{clause.text}</p>
            ) : null}

            {clause.items ? (
              <ul className="flex flex-col gap-2">
                {clause.items.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    className="flex gap-3 text-pretty leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-border" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <aside className="rounded-lg border bg-card p-5">
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Подробное описание обработки данных, сроков хранения и порядка обращений
          приведено в{' '}
          <Link
            href="/legal/privacy"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Политике обработки персональных данных
          </Link>
          .
        </p>
      </aside>
    </LegalShell>
  )
}
