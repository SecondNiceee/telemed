import type { CollectionConfig } from 'payload'

export const DoctorCategories: CollectionConfig = {
  slug: 'doctor-categories',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'description'],
    group: 'Контент',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin',
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Название',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: 'Слаг (URL)',
      admin: {
        description: 'Уникальный идентификатор для URL (например: therapist)',
      },
    },
    {
      name: 'description',
      type: 'text',
      label: 'Описание',
    },
    {
      name: 'icon',
      type: 'text',
      label: 'Иконка (Lucide)',
      admin: {
        description: 'Название иконки из библиотеки Lucide (например: stethoscope, heart, brain)',
      },
    },
  ],
}
