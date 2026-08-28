import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell } from '@/components/legal/legal-shell'
import { hasUnfilledRequisites } from '@/lib/legal/operator'
import { OFFER_TITLE, OFFER_VERSION, offerClauses } from '@/lib/legal/offer'

export const metadata: Metadata = {
  title: `${OFFER_TITLE} — smartcardio`,
  description:
    'Условия использования сервиса smartcardio: порядок записи на консультацию, оплата, отмена и возврат средств, ответственность сторон.',
  // Черновик не должен попадать в поиск: документ без реквизитов оператора
  // выглядит как действующий договор, но им не является.
  robots: hasUnfilledRequisites() ? { index: false, follow: false } : undefined,
}

export default function OfferPage() {
  const clauses = offerClauses()

  return (
    <LegalShell
      title={OFFER_TITLE}
      // Версия оферты, а не общая дата документов: в шапке должна стоять та же
      // редакция, что сохраняется пользователю при акцепте.
      version={OFFER_VERSION}
      lead="Договор между сервисом и пользователем: доступ к платформе, запись на консультацию, оплата и возврат. Медицинскую помощь оказывает медицинская организация, врача которой вы выбираете."
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
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-border"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <section className="flex flex-col gap-3 border-t pt-8">
        <h2 className="text-lg font-semibold leading-snug text-foreground">Связанные документы</h2>
        <ul className="flex flex-col gap-2">
          <li className="text-pretty leading-relaxed text-muted-foreground">
            <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-primary">
              Политика обработки персональных данных
            </Link>
            {' — как обрабатываются и защищаются данные.'}
          </li>
          <li className="text-pretty leading-relaxed text-muted-foreground">
            <Link href="/legal/consent" className="underline underline-offset-2 hover:text-primary">
              Согласие на обработку персональных данных
            </Link>
            {' — отдельный документ: согласие на данные о здоровье даётся не через оферту.'}
          </li>
          <li className="text-pretty leading-relaxed text-muted-foreground">
            <Link href="/legal/clinics" className="underline underline-offset-2 hover:text-primary">
              Медицинские организации и лицензии
            </Link>
            {' — кто именно оказывает медицинскую помощь.'}
          </li>
        </ul>
      </section>
    </LegalShell>
  )
}
