import type { GlobalConfig } from 'payload'
import { revalidateTag } from 'next/cache'
import { getCallerFromRequest } from '@/collections/helpers/auth'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Настройки сайта',
  admin: {
    group: 'Настройки',
  },
  access: {
    read: () => true,
    update: ({req}) => {
      const user = getCallerFromRequest(req);
      console.log(user);
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
      defaultValue: 'Ваш врач на расстоянии одного клика. Профессиональные консультации кардиологов и терапевтов без очередей и ожидания.',
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
          question: 'Как записаться на консультацию?',
          answer: 'Выберите нужную категорию врача, подберите удобное время и оформите запись. Вы получите уведомление с ссылкой на видеоконсультацию.',
        },
        {
          question: 'Какие врачи доступны на платформе?',
          answer: 'На нашей платформе работают лицензированные кардиологи, терапевты и другие специалисты с подтвержденной квалификацией.',
        },
        {
          question: 'Как проходит видеоконсультация?',
          answer: 'Консультация проходит через защищенное видеосоединение прямо в браузере. Вам не нужно устанавливать дополнительные программы.',
        },
        {
          question: 'Можно ли получить рецепт или больничный?',
          answer: 'Да, врач может выписать электронный рецепт или направление на анализы по результатам консультации.',
        },
      ],
    },
  ],
  hooks: {
    afterChange: [
      () => {
        revalidateTag('site-settings')
      },
    ],
  },
}
