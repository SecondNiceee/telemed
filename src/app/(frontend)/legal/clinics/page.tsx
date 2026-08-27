import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'
import { LegalShell } from '@/components/legal/legal-shell'

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

// Реестр меняется редко, поэтому кэшируем на час, а не собираем на каждый запрос.
export const revalidate = 3600

interface ClinicRow {
  id: number
  name: string
  legalName?: string | null
  inn?: string | null
  ogrn?: string | null
  legalAddress?: string | null
  privacyEmail?: string | null
  licenceNumber?: string | null
  licenceIssuedBy?: string | null
  licenceIssuedAt?: string | null
}

function formatDate(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

async function loadClinics(): Promise<ClinicRow[]> {
  try {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'organisations',
      depth: 0,
      limit: 200,
      sort: 'name',
      // Читаются только публичные сведения: наименование, реквизиты и лицензия.
      // Адрес электронной почты для входа в кабинет сюда намеренно не попадает.
      select: {
        name: true,
        legalName: true,
        inn: true,
        ogrn: true,
        legalAddress: true,
        privacyEmail: true,
        licenceNumber: true,
        licenceIssuedBy: true,
        licenceIssuedAt: true,
      },
    })
    return docs as ClinicRow[]
  } catch (error) {
    console.error('[legal/clinics] Не удалось загрузить реестр организаций:', error)
    return []
  }
}

export default async function LegalClinicsPage() {
  const clinics = await loadClinics()

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
