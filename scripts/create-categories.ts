/**
 * Скрипт для создания категорий врачей
 * Запуск: pnpm tsx scripts/create-categories.ts
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { CATEGORIES } from './seed-data.config'

async function createCategories() {
  console.log('🚀 Подключение к Payload CMS...')
  
  const payload = await getPayload({ config })
  console.log('✅ Подключение установлено\n')

  console.log('📁 Создание категорий врачей...\n')

  for (const category of CATEGORIES) {
    try {
      // Проверяем, существует ли категория
      const existing = await payload.find({
        collection: 'doctor-categories',
        where: {
          slug: { equals: category.slug },
        },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        console.log(`⚠️  Категория "${category.name}" уже существует (slug: ${category.slug})`)
        continue
      }

      // Создаем категорию
      const created = await payload.create({
        collection: 'doctor-categories',
        data: {
          name: category.name,
          slug: category.slug,
          description: category.description,
          icon: category.icon,
        },
        overrideAccess: true,
      })

      console.log(`✅ Создана категория: ${category.name} (ID: ${created.id})`)
    } catch (error) {
      console.error(`❌ Ошибка при создании категории "${category.name}":`, error)
    }
  }

  // Trigger cache revalidation
  console.log('\n🔄 Ревалидация кэша...')
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000'
  try {
    const response = await fetch(`${serverUrl}/api/revalidate?tag=categories`, { method: 'POST' })
    if (response.ok) {
      console.log('✅ Кэш категорий ревалидирован')
    } else {
      console.log(`⚠️  Кэш не ревалидирован (сервер не запущен?)`)
      console.log(`   После запуска: curl -X POST "${serverUrl}/api/revalidate?tag=categories"`)
    }
  } catch {
    console.log(`⚠️  Сервер недоступен. Ревалидируйте вручную после запуска сервера.`)
  }

  console.log('\n🎉 Готово!')
  process.exit(0)
}

createCategories().catch((error) => {
  console.error('❌ Критическая ошибка:', error)
  process.exit(1)
})
