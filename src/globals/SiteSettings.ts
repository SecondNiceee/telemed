import type { GlobalConfig } from 'payload'
import { getCallerFromRequest } from '@/collections/helpers/auth'

// Safe wrapper for revalidateTag that works in build time
const revalidateSiteSettingsCache = async () => {
  try {
    const { revalidateTag } = await import('next/cache')
    revalidateTag('site-settings')
  } catch {
    // revalidateTag is only available in Server Component context
  }
}

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Настройки сайта',
  admin: {
    group: 'Настройки',
  },
  access: {
    read: () => true,
    update: ({req}) => {
      const user = getCallerFromRequest(req, "users");
      return user.role === "admin"
    },
  },
  fields: [
    {
      name: 'heroTitle',
      type: 'text',
      label: 'Заголовок Hero секции',
      defaultValue: 'Забота о здоровье — без дороги в поликлинику',
      required: true,
    },
    {
      name: 'heroSubtitle',
      type: 'textarea',
      label: 'Подзаголовок Hero секции',
      defaultValue: 'Платформа дистанционного наблюдения и консультаций.',
    },
    {
      name: 'faq',
      type: 'array',
      label: 'FAQ',
      labels: {
        singular: 'Вопрос',
        plural: 'Вопросы',
      },
      fields: [
        {
          name: 'question',
          type: 'text',
          label: 'Вопрос',
          required: true,
        },
        {
          name: 'answer',
          type: 'textarea',
          label: 'Ответ',
          required: true,
        },
      ],
      defaultValue: [
        {
          question: 'С какими вопросами можно обратиться?',
          answer:
            'Вы можете обратиться, если хотите обсудить жалобы, результаты анализов и обследований, получить второе мнение, уточнить дальнейший план наблюдения или понять, нужен ли очный приём. Онлайн-формат особенно удобен для плановых консультаций и разбора уже имеющихся медицинских данных.',
        },
        {
          question: 'Что я получу после консультации?',
          answer:
            'После консультации вы получите рекомендации врача и медицинское заключение в электронном виде, если это предусмотрено форматом услуги. Документ будет доступен в личном кабинете.',
        },
        {
          question: 'Когда онлайн-консультация не подходит?',
          answer:
            'Онлайн-консультация не подходит при состояниях, требующих срочной медицинской помощи: например, сильная боль в груди, выраженная одышка, обморок, внезапная слабость или онемение, нарушение речи, резкое ухудшение самочувствия. В таких случаях нужно вызвать скорую помощь или обратиться в ближайшее медицинское учреждение.',
        },
        {
          question: 'Нужно ли устанавливать приложение?',
          answer:
            'Консультация проходит онлайн через браузер. Устанавливать дополнительные программы не нужно: достаточно телефона, планшета или компьютера с камерой, микрофоном и доступом в интернет.',
        },
      ],
    },
  ],
  hooks: {
    afterChange: [
      () => {
        revalidateSiteSettingsCache()
      },
    ],
  },
}
