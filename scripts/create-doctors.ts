/**
 * Скрипт для создания врачей
 * Требует предварительного создания категорий (create-categories.ts)
 * Запуск: pnpm tsx scripts/create-doctors.ts
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { DOCTORS, DEFAULT_ORGANISATION } from './seed-data.config'

/**
 * Генерирует расписание на неделю вперед (7 дней)
 * с 3 консультациями в день
 * Время консультаций: 09:00, 12:00, 15:00
 */
function generateDoctorSchedule(): Array<{ date: string; slots: Array<{ time: string }> }> {
  const schedule = []
  const today = new Date()

  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)

    // Форматируем дату в YYYY-MM-DD
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`

    // Добавляем 3 слота в день: 09:00, 12:00, 15:00
    schedule.push({
      date: dateStr,
      slots: [{ time: '09:00' }, { time: '12:00' }, { time: '15:00' }],
    })
  }

  return schedule
}

async function createDoctors() {
  console.log('🚀 Подключение к Payload CMS...')
  
  const payload = await getPayload({ config })
  console.log('✅ Подключение установлено\n')

  // 1. Получаем или создаем организацию
  console.log('🏥 Проверка организации...')
  
  let organisation = await payload.find({
    collection: 'organisations',
    where: {
      email: { equals: DEFAULT_ORGANISATION.email },
    },
    limit: 1,
  })

  let organisationId: number

  if (organisation.docs.length > 0) {
    organisationId = organisation.docs[0].id as number
    console.log(`✅ Организация найдена: ${DEFAULT_ORGANISATION.name} (ID: ${organisationId})`)
  } else {
    const created = await payload.create({
      collection: 'organisations',
      data: {
        name: DEFAULT_ORGANISATION.name,
        email: DEFAULT_ORGANISATION.email,
        password: DEFAULT_ORGANISATION.password,
      },
      overrideAccess: true,
    })
    organisationId = created.id as number
    console.log(`✅ Создана организация: ${DEFAULT_ORGANISATION.name} (ID: ${organisationId})`)
  }

  // 2. Получаем все категории для маппинга slug -> id
  console.log('\n📁 Загрузка категорий...')
  
  const categoriesResult = await payload.find({
    collection: 'doctor-categories',
    limit: 100,
  })

  const categoryMap = new Map<string, number>()
  for (const cat of categoriesResult.docs) {
    categoryMap.set(cat.slug, cat.id as number)
  }

  if (categoryMap.size === 0) {
    console.error('❌ Категории не найдены! Сначала запустите: pnpm tsx scripts/create-categories.ts')
    process.exit(1)
  }

  console.log(`✅ Загружено категорий: ${categoryMap.size}`)

  // 3. Создаем врачей
  console.log('\n👨‍⚕️ Создание врачей...\n')

  for (const doctor of DOCTORS) {
    try {
      // Проверяем, существует ли врач
      const existing = await payload.find({
        collection: 'doctors',
        where: {
          email: { equals: doctor.email },
        },
        limit: 1,
      })

      // Получаем ID категории
      const categoryId = categoryMap.get(doctor.categorySlug) as number | undefined
      if (categoryId === undefined) {
        console.error(`❌ Категория "${doctor.categorySlug}" не найдена для врача "${doctor.name}"`)
        continue
      }

      // Генерируем расписание на неделю вперед (7 дней) с 3 консультациями в день
      const schedule = generateDoctorSchedule()

      const doctorData = {
        name: doctor.name,
        email: doctor.email,
        password: doctor.password,
        organisation: organisationId,
        categories: [categoryId],
        experience: doctor.experience,
        degree: doctor.degree,
        price: doctor.price,
        bio: doctor.bio,
        education: doctor.education.map((value) => ({ value })),
        services: doctor.services.map((value) => ({ value })),
        slotDuration: doctor.slotDuration,
        schedule: schedule,
      }

      if (existing.docs.length > 0) {
        // Обновляем существующего врача
        const existingDoctor = existing.docs[0]
        await payload.update({
          collection: 'doctors',
          id: existingDoctor.id,
          data: doctorData,
          overrideAccess: true,
        })
        console.log(`🔄 Обновлен врач: ${doctor.name} (ID: ${existingDoctor.id}, категория: ${doctor.categorySlug})`)
        console.log(`   📅 Расписание: на неделю вперед, 3 консультации в день`)
      } else {
        // Создаем нового врача
        const created = await payload.create({
          collection: 'doctors',
          data: doctorData,
          overrideAccess: true,
        })
        console.log(`✅ Создан врач: ${doctor.name} (ID: ${created.id}, категория: ${doctor.categorySlug})`)
        console.log(`   📅 Расписание: на неделю вперед, 3 консультации в день`)
      }
    } catch (error) {
      console.error(`❌ Ошибка при создании врача "${doctor.name}":`, error)
    }
  }

  console.log('\n📋 Сводка:')
  console.log(`   Организация: ${DEFAULT_ORGANISATION.name}`)
  console.log(`   Email орг.: ${DEFAULT_ORGANISATION.email}`)
  console.log(`   Пароль орг.: ${DEFAULT_ORGANISATION.password}`)
  console.log(`   Пароль врачей: Doctor123!`)

  console.log('\n🎉 Готово!')
  process.exit(0)
}

createDoctors().catch((error) => {
  console.error('❌ Критическая ошибка:', error)
  process.exit(1)
})
