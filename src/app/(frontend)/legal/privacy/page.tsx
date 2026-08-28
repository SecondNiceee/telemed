import type { Metadata } from 'next'
import { LegalShell } from '@/components/legal/legal-shell'
import { hasUnfilledRequisites, operatorName } from '@/lib/legal/operator'
import { fetchOperatorRequisitesCached } from '@/lib/legal/operator.server'
import { POLICY_TITLE, policySections } from '@/lib/legal/privacy-policy'

// generateMetadata вместо статического metadata: признак «черновик» зависит от
// реквизитов в БД, а статический объект вычислялся бы один раз на сборке и после
// заполнения реквизитов в админке продолжал бы прятать страницу от поиска.
export async function generateMetadata(): Promise<Metadata> {
  const requisites = await fetchOperatorRequisitesCached()

  return {
    title: `${POLICY_TITLE} — smartcardio`,
    description:
      'Какие персональные данные обрабатываются в сервисе smartcardio, с какой целью, кто получает доступ и как реализуются права субъекта персональных данных.',
    // Черновик без реквизитов не должен попадать в поиск: документ выглядит
    // официальным, но оператора не называет.
    robots: hasUnfilledRequisites(requisites) ? { index: false, follow: false } : undefined,
  }
}

export default async function PrivacyPolicyPage() {
  const requisites = await fetchOperatorRequisitesCached()
  const sections = policySections(requisites)

  return (
    <LegalShell
      title={POLICY_TITLE}
      requisitesUnfilled={hasUnfilledRequisites(requisites)}
      lead="Документ описывает обработку персональных данных в сервисе smartcardio и составлен в соответствии с Федеральным законом № 152-ФЗ."
    >
      <nav aria-label="Содержание" className="rounded-lg border bg-card p-5">
        <p className="mb-3 text-sm font-medium text-foreground">Содержание</p>
        <ol className="flex flex-col gap-2">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-sm leading-relaxed text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((section) => (
        <section key={section.id} id={section.id} className="flex scroll-mt-24 flex-col gap-4">
          <h2 className="text-xl font-semibold leading-snug text-foreground">{section.title}</h2>

          {section.blocks.map((block, blockIndex) => {
            if (block.text) {
              return (
                <p key={blockIndex} className="text-pretty leading-relaxed text-muted-foreground">
                  {block.text}
                </p>
              )
            }

            if (block.items) {
              return (
                <ul key={blockIndex} className="flex flex-col gap-2">
                  {block.items.map((item, itemIndex) => (
                    <li
                      key={itemIndex}
                      className="flex gap-3 text-pretty leading-relaxed text-muted-foreground"
                    >
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-border" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )
            }

            if (block.table) {
              return (
                <div key={blockIndex} className="overflow-x-auto rounded-lg border">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-muted">
                      <tr>
                        {block.table.head.map((cell) => (
                          <th
                            key={cell}
                            scope="col"
                            className="px-4 py-3 font-medium text-foreground"
                          >
                            {cell}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {block.table.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t align-top">
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className={
                                cellIndex === 0
                                  ? 'px-4 py-3 font-medium leading-relaxed text-foreground'
                                  : 'px-4 py-3 leading-relaxed text-muted-foreground'
                              }
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }

            return null
          })}
        </section>
      ))}

      <section id="requisites" className="flex scroll-mt-24 flex-col gap-4 border-t pt-10">
        <h2 className="text-xl font-semibold leading-snug text-foreground">Реквизиты оператора</h2>
        <dl className="flex flex-col gap-3 text-sm">
          {[
            ['Наименование', operatorName(requisites)],
            ['ИНН', requisites.inn],
            ['ОГРН', requisites.ogrn],
            ['Адрес', requisites.address],
            ['Электронная почта', requisites.email],
            ['Телефон', requisites.phone],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
              <dt className="w-48 shrink-0 text-muted-foreground">{label}</dt>
              <dd className="font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </LegalShell>
  )
}
