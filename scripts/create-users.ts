/**
 * Скрипт создания тестовых пользователей
 *
 * Создает 10 обычных пользователей с верифицированным email.
 * Если пользователь уже существует - обновляет его данные.
 *
 * Запуск: pnpm tsx scripts/create-users.ts
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { USERS } from './seed-data.config'

async function createUsers() {
  console.log('Подключение к Payload CMS...')

  const payload = await getPayload({ config })

  console.log('Подключение установлено')
  console.log(`Создание ${USERS.length} пользователей...\n`)

  let created = 0
  let updated = 0

  for (const user of USERS) {
    try {
      // Проверяем, существует ли пользователь
      const existing = await payload.find({
        collection: 'users',
        where: {
          email: { equals: user.email },
        },
        limit: 1,
      })

      const userData = {
        name: user.name,
        email: user.email,
        password: user.password,
        role: 'user' as const,
        _verified: true,
      }

      if (existing.docs.length > 0) {
        // Обновляем существующего пользователя
        const existingUser = existing.docs[0]
        await payload.update({
          collection: 'users',
          id: existingUser.id,
          data: userData,
          overrideAccess: true,
        })
        console.log(`[update] ${user.name} (${user.email})`)
        updated++
      } else {
        // Создаем нового пользователя
        await payload.create({
          collection: 'users',
          data: userData,
          overrideAccess: true,
        })
        console.log(`[create] ${user.name} (${user.email})`)
        created++
      }
    } catch (error) {
      console.error(`[error] ${user.name}: ${error instanceof Error ? error.message : error}`)
    }
  }

  console.log('\n--- Результат ---')
  console.log(`Создано: ${created}`)
  console.log(`Обновлено: ${updated}`)

  console.log('\nДанные для входа:')
  console.log(`URL: ${process.env.SERVER_URL || 'http://localhost:3000'}`)
  console.log('Пароль для всех: User123!')

  console.log('\nГотово!')
  process.exit(0)
}

createUsers().catch((error) => {
  console.error('Ошибка:', error)
  process.exit(1)
})
