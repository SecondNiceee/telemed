import type { CollectionConfig, PayloadRequest } from 'payload'

async function isAdmin(req: PayloadRequest): Promise<boolean> {
  try {
    const { user } = await req.payload.auth({ headers: req.headers })
    return user?.role === 'admin'
  } catch {
    return false
  }
}

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role'],
    group: 'Пользователи',
  },
  auth: {
    verify: false,
  },
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create') {
          data._verified = true
        }
        return data
      },
    ],
  },
  access: {
    read: () => true,
    create: async ({ req }) => isAdmin(req),
    update: async ({ req, id }) => {
      const { user } = await req.payload.auth({ headers: req.headers })
      if (user?.role === 'admin') return true
      if (user?.id === id) return true
      return false
    },
    delete: async ({ req }) => isAdmin(req),
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'user',
      label: 'Роль',
      options: [
        { label: 'Пользователь', value: 'user' },
        { label: 'Врач', value: 'doctor' },
        { label: 'Администратор', value: 'admin' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'name',
      type: 'text',
      label: 'Имя',
    },
    // --- Doctor-specific fields ---
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'doctor-categories',
      hasMany: true,
      label: 'Специализации',
      admin: {
        condition: (data) => data?.role === 'doctor',
      },
    },
    {
      name: 'experience',
      type: 'number',
      label: 'Стаж (лет)',
      admin: {
        condition: (data) => data?.role === 'doctor',
      },
    },
    {
      name: 'degree',
      type: 'text',
      label: 'Степень / Категория',
      admin: {
        condition: (data) => data?.role === 'doctor',
        description: 'Например: Врач высшей категории, Кандидат медицинских наук',
      },
    },
    {
      name: 'price',
      type: 'number',
      label: 'Цена консультации (₽)',
      admin: {
        condition: (data) => data?.role === 'doctor',
      },
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      label: 'Фото',
      admin: {
        condition: (data) => data?.role === 'doctor',
      },
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'О враче',
      admin: {
        condition: (data) => data?.role === 'doctor',
      },
    },
    {
      name: 'education',
      type: 'array',
      label: 'Образование',
      admin: {
        condition: (data) => data?.role === 'doctor',
      },
      fields: [
        {
          name: 'value',
          type: 'text',
          label: 'Учебное заведение / Курс',
        },
      ],
    },
    {
      name: 'services',
      type: 'array',
      label: 'Услуги',
      admin: {
        condition: (data) => data?.role === 'doctor',
      },
      fields: [
        {
          name: 'value',
          type: 'text',
          label: 'Название услуги',
        },
      ],
    },
  ],
}
