/**
 * Скрипт для создания организации
 * Должен запускаться ПЕРЕД созданием врачей (create-doctors.ts)
 * Запуск: pnpm tsx scripts/create-organisation.ts
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { DEFAULT_ORGANISATION } from './seed-data.config'

async function createOrganisation() {
  console.log('🚀 Подключение к Payload CMS...')
  
  const payload = await getPayload({ config })
  console.log('✅ Подключение установлено\n')

  console.log('🏥 Создание организации...\n')

  try {
    // Проверяем, существует ли организация
    const existing = await payload.find({
      collection: 'organisations',
      where: {
        email: { equals: DEFAULT_ORGANISATION.email },
      },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      const org = existing.docs[0]
      console.log(`⚠️  Организация "${DEFAULT_ORGANISATION.name}" уже существует`)
      console.log(`   ID: ${org.id}`)
      console.log(`   Email: ${DEFAULT_ORGANISATION.email}`)
    } else {
      // Создаем организацию
      const created = await payload.create({
        collection: 'organisations',
        data: {
          name: DEFAULT_ORGANISATION.name,
          email: DEFAULT_ORGANISATION.email,
          password: DEFAULT_ORGANISATION.password,
        },
        overrideAccess: true,
      })

      console.log(`✅ Создана организация: ${DEFAULT_ORGANISATION.name}`)
      console.log(`   ID: ${created.id}`)
    }

    console.log('\n📋 Данные для входа в ЛК организации:')
    console.log(`   URL: ${process.env.SERVER_URL || 'http://localhost:3000'}/lk-org`)
    console.log(`   Email: ${DEFAULT_ORGANISATION.email}`)
    console.log(`   Пароль: ${DEFAULT_ORGANISATION.password}`)

    console.log('\n📌 Следующие шаги:')
    console.log('   1. pnpm tsx scripts/create-categories.ts  - создать категории')
    console.log('   2. pnpm tsx scripts/create-doctors.ts     - создать врачей')

  } catch (error) {
    console.error(`❌ Ошибка при создании организации:`, error)
    process.exit(1)
  }

  console.log('\n🎉 Готово!')
  process.exit(0)
}

createOrganisation().catch((error) => {
  console.error('❌ Критическая ошибка:', error)
  process.exit(1)
})
