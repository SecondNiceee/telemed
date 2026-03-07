import type { GlobalConfig } from 'payload'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Настройки сайта',
  admin: {
    group: 'Настройки',
  },
  access: {
    read: () => true,
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
      async () => {
        // Revalidate the homepage when settings change
        try {
          const baseUrl = process.env.SERVER_URL || 'http://localhost:3000'
          await fetch(`${baseUrl}/api/revalidate?tag=site-settings`, {
            method: 'POST',
          })
        } catch (error) {
          console.error('Failed to revalidate site-settings:', error)
        }
      },
    ],
  },
}
