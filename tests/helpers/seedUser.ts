import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

export const testUser = {
  /** Логин — email */
  email: 'dev@payloadcms.com',
  password: 'test',
  phone: '+79999999999',
  role: 'admin' as const,
}

/**
 * Seeds a test user for e2e admin tests.
 */
export async function seedTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  // Delete existing test user if any
  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
    overrideAccess: true,
  })

  await payload.create({
    collection: 'users',
    data: {
      ...testUser,
      // Вход возможен только с подтверждённым email
      _verified: true,
    },
    overrideAccess: true,
  })
}

/**
 * Cleans up test user after tests
 */
export async function cleanupTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
    overrideAccess: true,
  })
}
