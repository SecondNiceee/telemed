import 'server-only'

import { unstable_cache } from 'next/cache'
import type { ApiAppointment, ApiDoctor } from './types'

export const ORGANISATION_SUPPORT_PHONE_CACHE_TAG = 'organisation-support-phones'

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
