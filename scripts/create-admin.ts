/**
 * Скрипт создания администратора Payload CMS
 *
 * Создает пользователя с ролью admin для доступа к /admin панели.
 * Вход выполняется по email. Телефон — обязательное поле профиля.
 * Если пользователь с таким email уже существует, обновляет его роль на admin.
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
  console.log(`📧 Email: ${ADMIN.email}`)

  // Проверяем, существует ли пользователь с таким email
  const existingUsers = await payload.find({
    collection: 'users',
    where: {
      email: { equals: ADMIN.email },
    },
    limit: 1,
    overrideAccess: true,
  })

  if (existingUsers.docs.length > 0) {
    const existingUser = existingUsers.docs[0]
    console.log(`⚠️  Пользователь с email ${ADMIN.email} уже существует (ID: ${existingUser.id})`)

    if (existingUser.role === 'admin') {
      console.log('✅ Пользователь уже является администратором')
    } else {
      // Обновляем роль на admin
      await payload.update({
        collection: 'users',
        id: existingUser.id,
        data: {
          role: 'admin',
          phone: ADMIN.phone,
          _verified: true,
        },
        overrideAccess: true,
      })
      console.log('✅ Роль пользователя обновлена на admin')
    }
  } else {
    // Создаем нового пользователя-админа с подтверждённым email
    const newAdmin = await payload.create({
      collection: 'users',
      data: {
        email: ADMIN.email,
        phone: ADMIN.phone,
        password: ADMIN.password,
        name: ADMIN.name,
        role: 'admin',
        _verified: true,
      },
      overrideAccess: true, // Обход проверок доступа для установки роли и _verified
    })

    console.log(`✅ Администратор создан успешно (ID: ${newAdmin.id})`)
  }

  console.log('\n📋 Данные для входа:')
  console.log(`   URL: ${process.env.SERVER_URL || 'http://localhost:3000'}/admin`)
  console.log(`   Email: ${ADMIN.email}`)
  console.log(`   Пароль: ${ADMIN.password}`)

  console.log('\n🎉 Готово!')
  process.exit(0)
}

createAdmin().catch((error) => {
  console.error('❌ Ошибка:', error)
  process.exit(1)
})
