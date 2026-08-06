/**
 * Скрипт создания администратора Payload CMS
 * 
 * Создает пользователя с ролью admin для доступа к /admin панели.
 * Если пользователь с таким email уже существует, обновляет его роль на admin.
 * 
 * Запуск: pnpm tsx scripts/create-admin.ts
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const ADMIN_EMAIL = 'col1596321@gmail.com'
const ADMIN_PASSWORD = '11559966332211kkKK'
const ADMIN_NAME = 'Administrator'

async function createAdmin() {
  console.log('🚀 Подключение к Payload CMS...')
  
  const payload = await getPayload({ config })
  
  console.log('✅ Подключение установлено')
  console.log(`📧 Email: ${ADMIN_EMAIL}`)
  
  // Проверяем, существует ли пользователь с таким email
  const existingUsers = await payload.find({
    collection: 'users',
    where: {
      email: { equals: ADMIN_EMAIL },
    },
    limit: 1,
  })
  
  if (existingUsers.docs.length > 0) {
    const existingUser = existingUsers.docs[0]
    console.log(`⚠️  Пользователь с email ${ADMIN_EMAIL} уже существует (ID: ${existingUser.id})`)
    
    if (existingUser.role === 'admin') {
      console.log('✅ Пользователь уже является администратором')
    } else {
      // Обновляем роль на admin и верифицируем email
      await payload.update({
        collection: 'users',
        id: existingUser.id,
        data: {
          role: 'admin',
          _verified: true,
        },
        overrideAccess: true,
      })
      console.log('✅ Роль пользователя обновлена на admin, email верифицирован')
    }
  } else {
    // Создаем нового пользователя-админа с верифицированным email
    const newAdmin = await payload.create({
      collection: 'users',
      data: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        name: ADMIN_NAME,
        role: 'admin',
        _verified: true,
      },
      overrideAccess: true, // Обход проверок доступа для установки _verified
    })
    
    console.log(`✅ Администратор создан успешно (ID: ${newAdmin.id})`)
  }
  
  console.log('\n📋 Данные для входа:')
  console.log(`   URL: ${process.env.SERVER_URL || 'http://localhost:3000'}/admin`)
  console.log(`   Email: ${ADMIN_EMAIL}`)
  console.log(`   Пароль: ${ADMIN_PASSWORD}`)
  
  console.log('\n🎉 Готово!')
  process.exit(0)
}

createAdmin().catch((error) => {
  console.error('❌ Ошибка:', error)
  process.exit(1)
})
