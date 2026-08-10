/**
 * Конфигурация данных для заполнения базы
 * Категории врачей и врачи
 */

export interface OrganisationConfig {
  name: string
  email: string
  password: string
}

export interface CategoryConfig {
  name: string
  slug: string
  description: string
  icon: string
}

export interface AdminConfig {
  name: string
  /** Телефон в формате +7XXXXXXXXXX — логин администратора (users.username) */
  phone: string
  email?: string
  password: string
}

export interface UserConfig {
  name: string
  /** Телефон в формате +7XXXXXXXXXX — используется как логин (users.username) */
  phone: string
  /** Необязательный email (для уведомлений, не для входа) */
  email?: string
  password: string
}

export interface DoctorConfig {
  name: string
  email: string
  password: string
  categorySlug: string // привязка к категории по slug
  experience: number
  degree: string
  price: number
  bio: string
  education: string[]
  services: string[]
  slotDuration: '15' | '30' | '45' | '60' | '90'
}

// Тестовые пользователи (10 штук). Вход по телефону, email — опционально.
export const USERS: UserConfig[] = [
  { name: 'Александр Волков', phone: '+79000000001', email: 'volkov@smartcardio.ru', password: 'User123!' },
  { name: 'Мария Соколова', phone: '+79000000002', email: 'sokolova@smartcardio.ru', password: 'User123!' },
  { name: 'Дмитрий Морозов', phone: '+79000000003', email: 'morozov@smartcardio.ru', password: 'User123!' },
  { name: 'Екатерина Лебедева', phone: '+79000000004', email: 'lebedeva@smartcardio.ru', password: 'User123!' },
  { name: 'Сергей Новиков', phone: '+79000000005', email: 'novikov@smartcardio.ru', password: 'User123!' },
  { name: 'Анастасия Козлова', phone: '+79000000006', email: 'kozlova@smartcardio.ru', password: 'User123!' },
  { name: 'Андрей Попов', phone: '+79000000007', email: 'popov@smartcardio.ru', password: 'User123!' },
  { name: 'Ольга Васильева', phone: '+79000000008', email: 'vasilyeva@smartcardio.ru', password: 'User123!' },
  { name: 'Павел Зайцев', phone: '+79000000009', email: 'zaytsev@smartcardio.ru', password: 'User123!' },
  { name: 'Наталья Михайлова', phone: '+79000000010', email: 'mikhaylova@smartcardio.ru', password: 'User123!' },
]

// Администратор (вход в /admin по телефону)
export const ADMIN: AdminConfig = {
  name: 'Administrator',
  phone: '+79000000000',
  email: 'col1596321@gmail.com',
  password: '11559966332211kkKK',
}

// Организация по умолчанию для врачей
export const DEFAULT_ORGANISATION: OrganisationConfig = {
  name: 'МедЦентр "Здоровье"',
  email: 'org@telemed.local',
  password: 'OrgPassword123!',
}

// Категории врачей
export const CATEGORIES: CategoryConfig[] = [
  {
    name: 'Кардиология',
    slug: 'cardiology',
    description: 'Диагностика и лечение заболеваний сердечно-сосудистой системы',
    icon: 'heart',
  },
  {
    name: 'Неврология',
    slug: 'neurology',
    description: 'Диагностика и лечение заболеваний нервной системы',
    icon: 'brain',
  },
  {
    name: 'Терапия',
    slug: 'therapy',
    description: 'Общая медицинская помощь и профилактика заболеваний',
    icon: 'stethoscope',
  },
]

// Врачи (по 2 на категорию)
export const DOCTORS: DoctorConfig[] = [
  // Кардиологи
  {
    name: 'Иванов Алексей Петрович',
    email: 'ivanov.cardio@telemed.local',
    password: 'Doctor123!',
    categorySlug: 'cardiology',
    experience: 15,
    degree: 'Врач высшей категории, кандидат медицинских наук',
    price: 3500,
    bio: 'Специализируется на диагностике и лечении ишемической болезни сердца, артериальной гипертензии и нарушений сердечного ритма. Автор более 20 научных публикаций.',
    education: [
      'Первый МГМУ им. И.М. Сеченова (2005)',
      'Ординатура по кардиологии (2007)',
      'Курсы повышения квалификации РНИМУ им. Н.И. Пирогова (2020)',
    ],
    services: ['ЭКГ с расшифровкой', 'Холтеровское мониторирование', 'Консультация кардиолога'],
    slotDuration: '30',
  },
  {
    name: 'Смирнова Елена Викторовна',
    email: 'smirnova.cardio@telemed.local',
    password: 'Doctor123!',
    categorySlug: 'cardiology',
    experience: 10,
    degree: 'Врач первой категории',
    price: 2800,
    bio: 'Специализируется на функциональной диагностике сердечно-сосудистой системы. Опыт работы в ведущих кардиологических центрах Москвы.',
    education: [
      'РНИМУ им. Н.И. Пирогова (2012)',
      'Ординатура по кардиологии (2014)',
    ],
    services: ['Консультация кардиолога', 'Функциональная диагностика', 'Подбор терапии'],
    slotDuration: '30',
  },
  // Неврологи
  {
    name: 'Козлов Дмитрий Сергеевич',
    email: 'kozlov.neuro@telemed.local',
    password: 'Doctor123!',
    categorySlug: 'neurology',
    experience: 12,
    degree: 'Врач высшей категории',
    price: 3200,
    bio: 'Специализируется на лечении головных болей, мигрени, заболеваний позвоночника и периферической нервной системы.',
    education: [
      'МГУ им. М.В. Ломоносова, медицинский факультет (2010)',
      'Ординатура по неврологии (2012)',
      'Сертификат по мануальной терапии (2015)',
    ],
    services: ['Консультация невролога', 'Лечение головной боли', 'Мануальная терапия'],
    slotDuration: '45',
  },
  {
    name: 'Петрова Анна Михайловна',
    email: 'petrova.neuro@telemed.local',
    password: 'Doctor123!',
    categorySlug: 'neurology',
    experience: 8,
    degree: 'Врач первой категории',
    price: 2500,
    bio: 'Специализируется на лечении вегетативных расстройств, панических атак и неврозов. Применяет современные методики когнитивно-поведенческой терапии.',
    education: [
      'Казанский ГМУ (2014)',
      'Ординатура по неврологии (2016)',
    ],
    services: ['Консультация невролога', 'Лечение неврозов', 'Психотерапия'],
    slotDuration: '60',
  },
  // Терапевты
  {
    name: 'Федоров Михаил Александрович',
    email: 'fedorov.therapy@telemed.local',
    password: 'Doctor123!',
    categorySlug: 'therapy',
    experience: 20,
    degree: 'Врач высшей категории, доктор медицинских наук',
    price: 2000,
    bio: 'Опытный терапевт широкого профиля. Специализируется на диагностике и лечении внутренних болезней, ведении пациентов с хроническими заболеваниями.',
    education: [
      'Первый МГМУ им. И.М. Сеченова (2002)',
      'Аспирантура по внутренним болезням (2006)',
      'Докторантура (2015)',
    ],
    services: ['Первичная консультация', 'Диспансеризация', 'Ведение хронических больных'],
    slotDuration: '30',
  },
  {
    name: 'Николаева Ольга Игоревна',
    email: 'nikolaeva.therapy@telemed.local',
    password: 'Doctor123!',
    categorySlug: 'therapy',
    experience: 6,
    degree: 'Врач второй категории',
    price: 1500,
    bio: 'Молодой специалист с современным подходом к медицине. Специализи��уется на профилактике заболеваний и здоровом образе жизни.',
    education: [
      'РНИМУ им. Н.И. Пирогова (2016)',
      'Ординатура по терапии (2018)',
    ],
    services: ['Консультация терапевта', 'Профилактические осмотры', 'Рекомендации по ЗОЖ'],
    slotDuration: '30',
  },
]
