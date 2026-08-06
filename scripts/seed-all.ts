/**
 * Единый скрипт инициализации базы данных
 * 
 * Выполняет все скрипты заполнения БД в правильном порядке:
 * 1. Создание администратора
 * 2. Создание организации
 * 3. Создание категорий врачей
 * 4. Создание врачей с привязкой к категориям
 * 5. Создание тестовых пользователей
 * 
 * Запуск: pnpm tsx scripts/seed-all.ts
 */

import 'dotenv/config'
import { getPayload, type Payload } from 'payload'
import config from '../src/payload.config'
import { 
  USERS, 
  CATEGORIES, 
  DOCTORS, 
  DEFAULT_ORGANISATION,
  type DoctorConfig 
} from './seed-data.config'

const ADMIN_EMAIL = 'col1596321@gmail.com'
const ADMIN_PASSWORD = '11559966332211kkKK'
const ADMIN_NAME = 'Administrator'

// Helper to format dates for schedule
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Generate schedule slots for next 7 days
function generateScheduleSlots(startDate: Date, days: number = 7) {
  const schedule = []
  const times = ['09:00', '12:00', '15:00']

  for (let d = 0; d < days; d++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + d)
    const dateStr = formatDate(date)

    schedule.push({
      date: dateStr,
      slots: times.map(time => ({ time })),
    })
  }

  return schedule
}

async function createAdmin(payload: Payload) {
  console.log('\n📌 ШАГ 1: Создание администратора')
  console.log('─'.repeat(40))

  const existingUsers = await payload.find({
    collection: 'users',
    where: { email: { equals: ADMIN_EMAIL } },
    limit: 1,
  })

  if (existingUsers.docs.length > 0) {
    const existingUser = existingUsers.docs[0]
    if (existingUser.role === 'admin') {
      console.log(`✅ Администратор уже существует (ID: ${existingUser.id})`)
    } else {
      await payload.update({
        collection: 'users',
        id: existingUser.id,
        data: { role: 'admin', _verified: true },
        overrideAccess: true,
      })
      console.log(`✅ Роль обновлена на admin (ID: ${existingUser.id})`)
    }
    return existingUser
  }

  const newAdmin = await payload.create({
    collection: 'users',
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: ADMIN_NAME,
      role: 'admin',
      _verified: true,
    },
    overrideAccess: true,
  })

  console.log(`✅ Администратор создан (ID: ${newAdmin.id})`)
  console.log(`   Email: ${ADMIN_EMAIL}`)
  console.log(`   Пароль: ${ADMIN_PASSWORD}`)
  return newAdmin
}

async function createOrganisation(payload: Payload) {
  console.log('\n📌 ШАГ 2: Создание организации')
  console.log('─'.repeat(40))

  const existingOrgs = await payload.find({
    collection: 'organisations',
    where: { email: { equals: DEFAULT_ORGANISATION.email } },
    limit: 1,
  })

  if (existingOrgs.docs.length > 0) {
    console.log(`✅ Организация уже существует: ${DEFAULT_ORGANISATION.name} (ID: ${existingOrgs.docs[0].id})`)
    return existingOrgs.docs[0]
  }

  const org = await payload.create({
    collection: 'organisations',
    data: {
      name: DEFAULT_ORGANISATION.name,
      email: DEFAULT_ORGANISATION.email,
      password: DEFAULT_ORGANISATION.password,
    },
    overrideAccess: true,
  })

  console.log(`✅ Организация создана: ${DEFAULT_ORGANISATION.name} (ID: ${org.id})`)
  console.log(`   Email: ${DEFAULT_ORGANISATION.email}`)
  console.log(`   Пароль: ${DEFAULT_ORGANISATION.password}`)
  return org
}

async function createCategories(payload: Payload) {
  console.log('\n📌 ШАГ 3: Создание категорий врачей')
  console.log('─'.repeat(40))

  const categoryMap: Record<string, number> = {}
  let created = 0
  let skipped = 0

  for (const cat of CATEGORIES) {
    const existing = await payload.find({
      collection: 'doctor-categories',
      where: { slug: { equals: cat.slug } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      categoryMap[cat.slug] = existing.docs[0].id as number
      console.log(`⏭️  Категория "${cat.name}" уже существует (ID: ${existing.docs[0].id})`)
      skipped++
      continue
    }

    const newCat = await payload.create({
      collection: 'doctor-categories',
      data: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
      },
      overrideAccess: true,
    })

    categoryMap[cat.slug] = newCat.id as number
    console.log(`✅ Создана категория: ${cat.name} (ID: ${newCat.id})`)
    created++
  }

  console.log(`   Создано: ${created}, пропущено: ${skipped}`)
  return categoryMap
}

async function createDoctors(
  payload: Payload, 
  organisationId: number, 
  categoryMap: Record<string, number>
) {
  console.log('\n📌 ШАГ 4: Создание врачей')
  console.log('─'.repeat(40))

  let created = 0
  let updated = 0

  for (const doctor of DOCTORS as DoctorConfig[]) {
    const categoryId = categoryMap[doctor.categorySlug]
    if (!categoryId) {
      console.log(`⚠️  Категория "${doctor.categorySlug}" не найдена для врача ${doctor.email}`)
      continue
    }

    const scheduleSlots = generateScheduleSlots(new Date(), 7)

    const existing = await payload.find({
      collection: 'doctors',
      where: { email: { equals: doctor.email } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      await payload.update({
        collection: 'doctors',
        id: existing.docs[0].id,
        data: {
          name: doctor.name,
          categories: [categoryId],
          organisation: organisationId,
          experience: doctor.experience,
          degree: doctor.degree,
          price: doctor.price,
          bio: doctor.bio,
          education: doctor.education.map(value => ({ value })),
          services: doctor.services.map(value => ({ value })),
          slotDuration: doctor.slotDuration,
          schedule: scheduleSlots,
        },
        overrideAccess: true,
      })
      console.log(`🔄 Обновлён врач: ${doctor.name} (ID: ${existing.docs[0].id})`)
      updated++
      continue
    }

    const newDoctor = await payload.create({
      collection: 'doctors',
      data: {
        email: doctor.email,
        password: doctor.password,
        name: doctor.name,
        categories: [categoryId],
        organisation: organisationId,
        experience: doctor.experience,
        degree: doctor.degree,
        price: doctor.price,
        bio: doctor.bio,
        education: doctor.education.map(value => ({ value })),
        services: doctor.services.map(value => ({ value })),
        slotDuration: doctor.slotDuration,
        schedule: scheduleSlots,
      },
      overrideAccess: true,
    })

    console.log(`✅ Создан врач: ${doctor.name} (ID: ${newDoctor.id})`)
    created++
  }

  console.log(`   Создано: ${created}, обновлено: ${updated}`)
}

async function createUsers(payload: Payload) {
  console.log('\n📌 ШАГ 5: Создание тестовых пользователей')
  console.log('─'.repeat(40))

  let created = 0
  let updated = 0

  for (const user of USERS) {
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: user.email } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      await payload.update({
        collection: 'users',
        id: existing.docs[0].id,
        data: {
          name: user.name,
          role: 'user',
          _verified: true,
        },
        overrideAccess: true,
      })
      console.log(`🔄 Обновлён пользователь: ${user.name}`)
      updated++
      continue
    }

    const newUser = await payload.create({
      collection: 'users',
      data: {
        email: user.email,
        password: user.password,
        name: user.name,
        role: 'user',
        _verified: true,
      },
      overrideAccess: true,
    })

    console.log(`✅ Создан пользователь: ${user.name} (ID: ${newUser.id})`)
    created++
  }

  console.log(`   Создано: ${created}, обновлено: ${updated}`)
}

async function seedAll() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║           🚀 ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ 🚀                  ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  
  console.log('\n🔌 Подключение к Payload CMS...')
  const payload = await getPayload({ config })
  console.log('✅ Подключение установлено')

  // Step 1: Create admin
  await createAdmin(payload)

  // Step 2: Create organisation
  const org = await createOrganisation(payload)

  // Step 3: Create categories
  const categoryMap = await createCategories(payload)

  // Step 4: Create doctors
  await createDoctors(payload, org.id as number, categoryMap)

  // Step 5: Create users
  await createUsers(payload)

  // Summary
  // Step 6: Trigger cache revalidation
  console.log('\n📌 ШАГ 6: Ревалидация кэша')
  console.log('─'.repeat(40))
  
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000'
  try {
    const revalidateUrl = `${serverUrl}/api/revalidate?all=true`
    const response = await fetch(revalidateUrl, { method: 'POST' })
    
    if (response.ok) {
      const data = await response.json()
      console.log(`✅ Кэш ревалидирован: ${data.tags?.join(', ') || 'all'}`)
    } else {
      console.log(`⚠️  Не удалось ревалидировать кэш (сервер не запущен?)`)
      console.log(`   Запустите сервер и вызовите: curl -X POST "${revalidateUrl}"`)
    }
  } catch {
    console.log(`⚠️  Сервер недоступен для ревалидации`)
    console.log(`   После запуска сервера выполните: curl -X POST "${serverUrl}/api/revalidate?all=true"`)
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║                    ✅ ГОТОВО!                              ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('\n📋 Сводка учётных данных:')
  console.log('─'.repeat(50))
  console.log('🔐 Администратор:')
  console.log(`   Email: ${ADMIN_EMAIL}`)
  console.log(`   Пароль: ${ADMIN_PASSWORD}`)
  console.log(`   URL: ${process.env.SERVER_URL || 'http://localhost:3000'}/admin`)
  console.log('')
  console.log('🏥 Организация:')
  console.log(`   Email: ${DEFAULT_ORGANISATION.email}`)
  console.log(`   Пароль: ${DEFAULT_ORGANISATION.password}`)
  console.log('')
  console.log('👨‍⚕️ Врачи:')
  console.log(`   Пароль для всех: Doctor123!`)
  console.log('')
  console.log('👥 Пользователи:')
  console.log(`   Пароль для всех: User123!`)
  console.log('─'.repeat(50))

  process.exit(0)
}

seedAll().catch((error) => {
  console.error('\n❌ Ошибка инициализации:', error)
  process.exit(1)
})
