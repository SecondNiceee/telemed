import { getPayload } from 'payload'
import config from './payload.config'

const categoriesData = [
  {
    name: 'Терапевт',
    slug: 'therapist',
    description: 'Общая диагностика и лечение',
    icon: 'stethoscope',
  },
  {
    name: 'Кардиолог',
    slug: 'cardiologist',
    description: 'Заболевания сердца и сосудов',
    icon: 'heart',
  },
  {
    name: 'Невролог',
    slug: 'neurologist',
    description: 'Нервная система и головные боли',
    icon: 'brain',
  },
  {
    name: 'Дерматолог',
    slug: 'dermatologist',
    description: 'Кожные заболевания',
    icon: 'scan',
  },
  {
    name: 'Педиатр',
    slug: 'pediatrician',
    description: 'Здоровье детей',
    icon: 'baby',
  },
  {
    name: 'Психолог',
    slug: 'psychologist',
    description: 'Психологическая помощь',
    icon: 'brain',
  },
]

interface DoctorSeedData {
  email: string
  password: string
  name: string
  categorySlugs: string[]
  experience: number
  degree: string
  price: number
  bio: string
  education: string[]
  services: string[]
}

const doctorsData: DoctorSeedData[] = [
  {
    email: 'ivanova@smartcardio.ru',
    password: 'doctor123456',
    name: 'Иванова Мария Петровна',
    categorySlugs: ['therapist'],
    experience: 15,
    degree: 'Кандидат медицинских наук',
    price: 2500,
    bio: 'Специализируюсь на диагностике и лечении заболеваний внутренних органов. Особое внимание уделяю профилактике и раннему выявлению патологий. Владею современными методами диагностики.',
    education: [
      'Первый МГМУ им. И.М. Сеченова, 2009',
      'Ординатура по терапии, 2011',
      'Защита кандидатской диссертации, 2015',
    ],
    services: [
      'Первичная консультация',
      'Расшифровка анализов',
      'Составление плана лечения',
      'Профилактический осмотр',
    ],
  },
  {
    email: 'petrov@smartcardio.ru',
    password: 'doctor123456',
    name: 'Петров Алексей Сергеевич',
    categorySlugs: ['therapist'],
    experience: 12,
    degree: 'Врач высшей категории',
    price: 2200,
    bio: 'Более 12 лет практикую в области терапии. Специализируюсь на лечении респираторных заболеваний и патологий ЖКТ. Индивидуальный подход к каждому пациенту.',
    education: [
      'РНИМУ им. Н.И. Пирогова, 2012',
      'Ординатура по терапии, 2014',
      'Повышение квалификации по гастроэнтерологии, 2020',
    ],
    services: [
      'Консультация терапевта',
      'Диагностика заболеваний',
      'Назначение лечения',
      'Выписка рецептов',
    ],
  },
  {
    email: 'sidorova@smartcardio.ru',
    password: 'doctor123456',
    name: 'Сидорова Елена Владимировна',
    categorySlugs: ['cardiologist'],
    experience: 20,
    degree: 'Доктор медицинских наук',
    price: 3500,
    bio: 'Ведущий специалист в области кардиологии с 20-летним опытом. Занимаюсь диагностикой и лечением ишемической болезни сердца, аритмий, артериальной гипертензии.',
    education: [
      'Первый МГМУ им. И.М. Сеченова, 2004',
      'Докторантура по кардиологии, 2012',
      'Стажировка в Германии, 2016',
    ],
    services: [
      'ЭКГ расшифровка',
      'Лечение гипертонии',
      'Профилактика инфаркта',
      'Реабилитация после операций',
    ],
  },
  {
    email: 'kozlov@smartcardio.ru',
    password: 'doctor123456',
    name: 'Козлов Дмитрий Андреевич',
    categorySlugs: ['cardiologist'],
    experience: 18,
    degree: 'Кандидат медицинских наук',
    price: 3200,
    bio: 'Кардиолог с большим опытом работы в стационаре и амбулаторной практике. Специализируюсь на нарушениях ритма сердца и сердечной недостаточности.',
    education: [
      'РНИМУ им. Н.И. Пирогова, 2006',
      'Ординатура по кардиологии, 2008',
      'Кандидатская диссертация, 2013',
    ],
    services: [
      'Диагностика аритмий',
      'Подбор терапии',
      'Холтер-мониторинг',
      'Консультация по результатам обследований',
    ],
  },
  {
    email: 'novikova@smartcardio.ru',
    password: 'doctor123456',
    name: 'Новикова Анна Игоревна',
    categorySlugs: ['neurologist'],
    experience: 14,
    degree: 'Врач первой категории',
    price: 2800,
    bio: 'Занимаюсь лечением головных болей, мигреней, заболеваний позвоночника. Применяю комплексный подход с использованием медикаментозных и немедикаментозных методов.',
    education: [
      'Казанский ГМУ, 2010',
      'Ординатура по неврологии, 2012',
      'Курсы по мануальной терапии, 2018',
    ],
    services: [
      'Лечение головной боли',
      'Терапия остеохондроза',
      'Лечение невралгии',
      'Реабилитация после инсульта',
    ],
  },
  {
    email: 'morozov@smartcardio.ru',
    password: 'doctor123456',
    name: 'Морозов Игорь Валентинович',
    categorySlugs: ['neurologist'],
    experience: 22,
    degree: 'Доктор медицинских наук, профессор',
    price: 3800,
    bio: 'Профессор, автор более 50 научных публикаций. Специализируюсь на сложных неврологических случаях, эпилепсии, болезни Паркинсона и рассеянном склерозе.',
    education: [
      'Первый МГМУ им. И.М. Сеченова, 2002',
      'Докторская диссертация, 2014',
      'Профессор кафедры неврологии, 2019',
    ],
    services: [
      'Диагностика эпилепсии',
      'Лечение болезни Паркинсона',
      'Терапия рассеянного склероза',
      'Второе мнение',
    ],
  },
  {
    email: 'volkova@smartcardio.ru',
    password: 'doctor123456',
    name: 'Волкова Ольга Николаевна',
    categorySlugs: ['dermatologist'],
    experience: 11,
    degree: 'Кандидат медицинских наук',
    price: 2600,
    bio: 'Дерматолог-косметолог с опытом работы в ведущих клиниках. Лечу акне, экзему, псориаз. Провожу консультации по уходу за кожей и anti-age терапии.',
    education: [
      'РНИМУ им. Н.И. Пирогова, 2013',
      'Ординатура по дерматовенерологии, 2015',
      'Курсы косметологии, 2017',
    ],
    services: [
      'Лечение акне',
      'Терапия псориаза',
      'Диагностика родинок',
      'Подбор уходовых средств',
    ],
  },
  {
    email: 'sokolov@smartcardio.ru',
    password: 'doctor123456',
    name: 'Соколов Артем Викторович',
    categorySlugs: ['pediatrician'],
    experience: 16,
    degree: 'Врач высшей категории',
    price: 2400,
    bio: 'Детский врач с большим опытом работы. Наблюдаю детей с рождения до 18 лет. Особое внимание уделяю профилактике заболеваний и вакцинации.',
    education: [
      'Первый МГМУ им. И.М. Сеченова, 2008',
      'Ординатура по педиатрии, 2010',
      'Курсы по неонатологии, 2015',
    ],
    services: [
      'Осмотр ребенка',
      'Консультация по вакцинации',
      'Лечение ОРВИ',
      'Наблюдение за развитием',
    ],
  },
  {
    email: 'lebedeva@smartcardio.ru',
    password: 'doctor123456',
    name: 'Лебедева Татьяна Сергеевна',
    categorySlugs: ['psychologist'],
    experience: 13,
    degree: 'Кандидат психологических наук',
    price: 3000,
    bio: 'Клинический психолог, работаю с тревожными расстройствами, депрессией, проблемами в отношениях. Использую когнитивно-поведенческую терапию.',
    education: [
      'МГУ им. М.В. Ломоносова, 2011',
      'Кандидатская диссертация, 2016',
      'Сертификация КПТ, 2018',
    ],
    services: [
      'Индивидуальная терапия',
      'Работа с тревогой',
      'Семейное консультирование',
      'Коучинг',
    ],
  },
  {
    email: 'kuznetsov@smartcardio.ru',
    password: 'doctor123456',
    name: 'Кузнецов Павел Александрович',
    categorySlugs: ['psychologist'],
    experience: 19,
    degree: 'Доктор психологических наук',
    price: 3500,
    bio: 'Профессор психологии, автор методик по работе со стрессом. Специализируюсь на кризисных состояниях, профессиональном выгорании и психосоматике.',
    education: [
      'СПбГУ, 2005',
      'Докторская диссертация, 2015',
      'Международная сертификация, 2020',
    ],
    services: [
      'Кризисная помощь',
      'Терапия выгорания',
      'Работа с психосоматикой',
      'Супервизия',
    ],
  },
]

async function seed() {
  console.log('Starting seed...')

  const payload = await getPayload({ config })

  // -------- 1. Seed categories --------
  console.log('Seeding categories...')

  const categoryMap = new Map<string, number>()

  for (const cat of categoriesData) {
    // Check if already exists
    const existing = await payload.find({
      collection: 'doctor-categories',
      where: { slug: { equals: cat.slug } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      console.log(`  Category "${cat.name}" already exists (id: ${existing.docs[0].id})`)
      categoryMap.set(cat.slug, existing.docs[0].id)
    } else {
      const created = await payload.create({
        collection: 'doctor-categories',
        data: cat,
      })
      console.log(`  Created category "${cat.name}" (id: ${created.id})`)
      categoryMap.set(cat.slug, created.id)
    }
  }

  // -------- 2. Seed doctors --------
  console.log('Seeding doctors...')

  for (const doc of doctorsData) {
    // Check if already exists by email
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: doc.email } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      console.log(`  Doctor "${doc.name}" already exists (id: ${existing.docs[0].id})`)
      continue
    }

    const categoryIds = doc.categorySlugs
      .map((slug) => categoryMap.get(slug))
      .filter((id): id is number => id !== undefined)

    await payload.create({
      collection: 'users',
      data: {
        email: doc.email,
        password: doc.password,
        role: 'doctor',
        name: doc.name,
        categories: categoryIds,
        experience: doc.experience,
        degree: doc.degree,
        price: doc.price,
        bio: doc.bio,
        education: doc.education.map((value) => ({ value })),
        services: doc.services.map((value) => ({ value })),
      },
    })
    console.log(`  Created doctor "${doc.name}"`)
  }

  console.log('Seed completed successfully!')
  process.exit(0)
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
