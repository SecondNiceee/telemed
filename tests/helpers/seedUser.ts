import { getPayload } from 'payload'
import config from '../../src/payload.config.js'


export const testUser = {
  /** Логин — номер телефона (users.username) */
  username: '+79999999999',
  email: 'dev@payloadcms.com',
  password: 'test',
  role: 'user' as const,
  phoneVerified: true,
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
      username: {
        equals: testUser.username,
      },
    },
  })

  await payload.create({
    collection: 'users',
    data: testUser,
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
      username: {
        equals: testUser.username,
      },
    },
  })
}
