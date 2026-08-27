import type { Metadata } from 'next'
import { LegalShell } from '@/components/legal/legal-shell'
import {
  fetchClinicRegistryCached,
  type ClinicRegistryRow,
} from '@/lib/api/organisations.server'

export const metadata: Metadata = {
  title: 'Медицинские организации на платформе — smartcardio',
  description:
    'Реестр медицинских организаций, подключённых к сервису smartcardio: наименование, реквизиты, лицензия на медицинскую деятельность и адрес для обращений по персональным данным.',
}

/**
 * Реестр подключённых медицинских организаций.
 *
 * Зачем страница нужна: по данным о здоровье оператор - клиника, а платформа
 * обрабатывает их по её поручению. Значит пациент должен видеть, кто именно
 * отвечает за его данные и по какой лицензии оказывается услуга.
 *
 * Почему реестр отдельной страницей, а не списком внутри политики: клиник на
 * маркетплейсе много и состав меняется. Перечислять их в тексте политики
 * означало бы правку юридического документа при каждом подключении клиники, а
 * документ с устаревшим перечнем хуже, чем ссылка на актуальный реестр.
 *
 * Данные берутся из БД и заполняются самими клиниками в их кабинете: платформа
 * не вправе заявлять реквизиты за клинику.
 */

/**
 * Кэш реестра сбрасывается ТЕГОМ из хука коллекции, а не по таймеру: подключение
 * новой клиники и исправление реквизитов должны попадать на страницу сразу.
 * Раньше здесь стоял revalidate = 3600, из-за чего юридическая страница до часа
 * показывала неверного ответственного за данные о здоровье.
 */
function formatDate(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default async function LegalClinicsPage() {
  const clinics: ClinicRegistryRow[] = await fetchClinicRegistryCached()

  return (
    <LegalShell
      title="Медицинские организации на платформе"
      lead="Медицинские услуги оказывают перечисленные организации — каждая на основании собственной лицензии. В отношении данных о здоровье пациента оператором персональных данных выступает та организация, к врачу которой пациент обратился."
    >
      <p className="text-pretty leading-relaxed text-muted-foreground">
        Сервис smartcardio обеспечивает техническую возможность консультации: личный
        кабинет, видеосвязь, чат и приём оплаты. Данные о здоровье обрабатываются в
        Сервисе по поручению медицинской организации в соответствии с ч. 3 ст. 6
        Федерального закона № 152-ФЗ. Обращения по таким данным — включая отзыв
        согласия и требование об удалении — направляются в организацию по указанному
        ниже адресу.
      </p>

      {clinics.length === 0 ? (
        <p className="rounded-lg border bg-card p-5 text-pretty leading-relaxed text-muted-foreground">
          На данный момент к Сервису не подключено ни одной медицинской организации.
        </p>
      ) : (
        <ul className="flex flex-col gap-6">
          {clinics.map((clinic) => {
            const rows: [string, string | null][] = [
              ['Полное наименование', clinic.legalName ?? null],
              ['ИНН', clinic.inn ?? null],
              ['ОГРН', clinic.ogrn ?? null],
              ['Юридический адрес', clinic.legalAddress ?? null],
              ['Лицензия на медицинскую деятельность', clinic.licenceNumber ?? null],
              ['Кем выдана лицензия', clinic.licenceIssuedBy ?? null],
              ['Дата выдачи лицензии', formatDate(clinic.licenceIssuedAt)],
              ['Обращения по персональным данным', clinic.privacyEmail ?? null],
            ]

            const filled = rows.filter(([, value]) => Boolean(value))
            const missingCount = rows.length - filled.length

            return (
              <li key={clinic.id} className="rounded-lg border bg-card p-5">
                <h2 className="text-lg font-semibold leading-snug text-foreground">
                  {clinic.name}
                </h2>

                {filled.length > 0 && (
                  <dl className="mt-4 flex flex-col gap-3 text-sm">
                    {filled.map(([label, value]) => (
                      <div key={label} className="flex flex-col gap-1 sm:flex-row sm:gap-4">
                        <dt className="w-64 shrink-0 text-muted-foreground">{label}</dt>
                        <dd className="text-pretty font-medium text-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {/*
                  Пропуски показываем честно, а не прячем: пока организация не
                  заполнила сведения, пациент действительно не знает, кто отвечает
                  за его данные. Тихо скрытый пропуск создавал бы вид полноты.
                */}
                {missingCount > 0 && (
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    Организация не указала часть сведений ({missingCount} из {rows.length}).
                    Запросить их можно у организации напрямую или через поддержку Сервиса.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </LegalShell>
  )
}
