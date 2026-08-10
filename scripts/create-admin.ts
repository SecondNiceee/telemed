/**
 * Скрипт создания администратора Payload CMS
 *
 * Создает пользователя с ролью admin для доступа к /admin панели.
 * Вход выполняется по номеру телефона (поле users.username).
 * Если пользователь с таким телефоном уже существует, обновляет его роль на admin.
 *
 * Запуск: pnpm tsx scripts/create-admin.ts
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { ADMIN } from './seed-data.config'

async function createAdmin() {
  console.log('🚀 Подключение к Payload CMS...')

  const payload = await getPayload({ config })

  console.log('✅ Подключение установлено')
  console.log(`📱 Телефон: ${ADMIN.phone}`)

  // Проверяем, существует ли пользователь с таким телефоном
  const existingUsers = await payload.find({
    collection: 'users',
    where: {
      username: { equals: ADMIN.phone },
    },
    limit: 1,
    overrideAccess: true,
  })

  if (existingUsers.docs.length > 0) {
    const existingUser = existingUsers.docs[0]
    console.log(`⚠️  Пользователь с телефоном ${ADMIN.phone} уже существует (ID: ${existingUser.id})`)

    if (existingUser.role === 'admin' && existingUser.phoneVerified) {
      console.log('✅ Пользователь уже является подтверждённым администратором')
    } else {
      // Обновляем роль на admin и подтверждаем телефон
      await payload.update({
        collection: 'users',
        id: existingUser.id,
        data: {
          role: 'admin',
          phoneVerified: true,
        },
        overrideAccess: true,
      })
      console.log('✅ Роль пользователя обновлена на admin, телефон подтверждён')
    }
  } else {
    // Создаем нового пользователя-админа с подтверждённым телефоном
    const newAdmin = await payload.create({
      collection: 'users',
      data: {
        username: ADMIN.phone,
        ...(ADMIN.email ? { email: ADMIN.email } : {}),
        password: ADMIN.password,
        name: ADMIN.name,
        role: 'admin',
        phoneVerified: true,
      },
      overrideAccess: true, // Обход проверок доступа для установки phoneVerified
    })

    console.log(`✅ Администратор создан успешно (ID: ${newAdmin.id})`)
  }

  console.log('\n📋 Данные для входа:')
  console.log(`   URL: ${process.env.SERVER_URL || 'http://localhost:3000'}/admin`)
  console.log(`   Телефон: ${ADMIN.phone}`)
  console.log(`   Пароль: ${ADMIN.password}`)

  console.log('\n🎉 Готово!')
  process.exit(0)
}

createAdmin().catch((error) => {
  console.error('❌ Ошибка:', error)
  process.exit(1)
})
