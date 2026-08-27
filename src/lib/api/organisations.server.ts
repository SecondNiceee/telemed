import 'server-only'

import { unstable_cache } from 'next/cache'
import type { ApiAppointment, ApiDoctor } from './types'

export const ORGANISATION_SUPPORT_PHONE_CACHE_TAG = 'organisation-support-phones'

/** Тег кэша публичного реестра клиник (/legal/clinics). */
export const ORGANISATION_REGISTRY_CACHE_TAG = 'organisations-registry'

/** Публичные сведения об организации для реестра. Логин-email сюда не входит. */
export interface ClinicRegistryRow {
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

/**
 * Реестр организаций для публичной страницы.
 *
 * Кэш инвалидируется ТЕГОМ, а не по времени: раньше страница стояла на
 * revalidate = 3600, и после подключения новой клиники или исправления ИНН
 * реестр до часа показывал старые данные. Для обычного списка это терпимо, для
 * юридического документа - нет: там висел бы неверный ответственный за данные о
 * здоровье. Хук afterChange в коллекции сбрасывает этот тег.
 *
 * limit: 200 - осознанный предел: при большем числе клиник нужна постраничная
 * навигация, а не молча обрезанный реестр.
 */
export const fetchClinicRegistryCached = unstable_cache(
  async (): Promise<ClinicRegistryRow[]> => {
    try {
      // getPayload ОБЯЗАН быть внутри try: он сам падает, если нет секрета или
      // строки подключения к БД. Когда он стоял снаружи, юридическая страница
      // отдавала 500 вместо честного «организации не подключены» - проверено
      // curl'ом, регрессия была поймана именно так.
      const [{ getPayload }, configModule] = await Promise.all([
        import('payload'),
        import('@/payload.config'),
      ])
      const payload = await getPayload({ config: configModule.default })

      const { docs } = await payload.find({
        collection: 'organisations',
        depth: 0,
        limit: 200,
        sort: 'name',
        // Только публичные сведения: наименование, реквизиты, лицензия.
        // Email для входа в кабинет намеренно не запрашивается.
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

      return docs as ClinicRegistryRow[]
    } catch (error) {
      console.error('[legal/clinics] Не удалось загрузить реестр организаций:', {
        error: error instanceof Error ? error.message : error,
      })
      // Пустой список -> страница покажет честное сообщение вместо падения.
      return []
    }
  },
  ['organisations-registry'],
  { tags: [ORGANISATION_REGISTRY_CACHE_TAG] },
)

const getOrganisationSupportPhoneCached = unstable_cache(
  async (organisationId: number): Promise<string | null> => {
    const [{ getPayload }, configModule] = await Promise.all([
      import('payload'),
      import('@/payload.config'),
    ])
    const payload = await getPayload({ config: configModule.default })

    try {
      const organisation = await payload.findByID({
        collection: 'organisations',
        id: organisationId,
        depth: 0,
        select: { supportPhone: true },
      })

      return organisation.supportPhone?.trim() || null
    } catch (error) {
      console.error('[organisation-support-phone] Lookup failed:', {
        organisationId,
        error: error instanceof Error ? error.message : error,
      })
      return null
    }
  },
  ['organisation-support-phone'],
  { tags: [ORGANISATION_SUPPORT_PHONE_CACHE_TAG] },
)

function getDoctorOrganisationId(appointment: ApiAppointment): number | null {
  if (typeof appointment.doctor === 'number') return null

  const organisation = (appointment.doctor as ApiDoctor).organisation
  if (typeof organisation === 'number') return organisation
  return organisation?.id ?? null
}

/** Adds the clinic support phone to appointments without caching patient data. */
export async function withOrganisationSupportPhones(
  appointments: ApiAppointment[],
): Promise<ApiAppointment[]> {
  const organisationIds = [
    ...new Set(
      appointments
        .map(getDoctorOrganisationId)
        .filter((id): id is number => id !== null),
    ),
  ]

  const phones = await Promise.all(
    organisationIds.map(async (id) => [id, await getOrganisationSupportPhoneCached(id)] as const),
  )
  const phoneByOrganisationId = new Map(phones)

  return appointments.map((appointment) => {
    const organisationId = getDoctorOrganisationId(appointment)
    return {
      ...appointment,
      organisationSupportPhone:
        organisationId === null ? null : phoneByOrganisationId.get(organisationId) ?? null,
    }
  })
}
