import type { CollectionConfig, PayloadRequest } from 'payload'
import { getCallerFromRequest } from './helpers/auth'

const ORGANISATION_SUPPORT_PHONE_CACHE_TAG = 'organisation-support-phones'

const revalidateOrganisationSupportPhones = async () => {
  try {
    const { revalidateTag } = await import('next/cache')
    revalidateTag(ORGANISATION_SUPPORT_PHONE_CACHE_TAG)
  } catch (error) {
    console.warn(
      '[organisations] Support phone cache revalidation skipped:',
      error instanceof Error ? error.message : error,
    )
  }
}

/**
 * Populate req.user from the organisations cookie (organisations-token) without a DB query.
 * JWT already contains id, email, collection -- enough for all access checks.
 */


export const Organisations: CollectionConfig = {
  slug: 'organisations',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email'],
    group: 'Пользователи',
  },
  auth: {
    verify: false,
    tokenExpiration: 60 * 60 * 24 * 7, // 7 days
  },
  hooks: {
    beforeOperation: [],
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create') {
          data._verified = true
        }
        return data
      },
    ],
    afterChange: [
      async () => {
        await revalidateOrganisationSupportPhones()
      },
    ],
    afterDelete: [
      async () => {
        await revalidateOrganisationSupportPhones()
      },
    ],
  },
  access: {
    read: () => true,
    create: ({ req }) => {
      const user = getCallerFromRequest(req, 'users')
      return user?.role === 'admin'
    },
    update: ({ req, id }) => {
      const userCaller = getCallerFromRequest(req, 'users')
      if (userCaller?.role === 'admin') return true;

      const organisationCaller = getCallerFromRequest(req, "organisations");
      // Organisation can update itself
      if (organisationCaller?.collection === 'organisations' && organisationCaller.id && String(organisationCaller.id) === String(id)) return true
      return false
    },
    delete: ({ req }) => {
      const caller = getCallerFromRequest(req, 'users');
      return caller?.role === 'admin';
    },
    admin: () => false, // Organisations don't access Payload Admin Panel
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Название организации',
      required: true,
    },
    {
      name: 'supportPhone',
      type: 'text',
      label: 'Телефон поддержки',
    },
    /**
     * Юридические реквизиты медицинской организации.
     *
     * Нужны не для отчётности, а потому что по медицинским данным оператор -
     * клиника, а платформа обрабатывает их по её поручению (ч. 3 ст. 6 152-ФЗ).
     * Согласие обязано называть конкретного оператора (п. 3 ч. 4 ст. 9 152-ФЗ),
     * а до появления этих полей подставить в текст было нечего: в коллекции
     * были только name и supportPhone.
     *
     * Поэтому это не «поля на будущее»: без них согласие на консультацию
     * физически не может назвать того, кто отвечает за данные о здоровье.
     *
     * Сведения о лицензии и реквизиты медицинская организация обязана
     * раскрывать пациенту, поэтому их публичное чтение здесь ожидаемо.
     */
    {
      name: 'legalName',
      type: 'text',
      label: 'Полное наименование юридического лица',
      admin: {
        description: 'Как в ЕГРЮЛ. Подставляется в согласие пациента как оператор его медицинских данных.',
      },
    },
    {
      name: 'inn',
      type: 'text',
      label: 'ИНН',
    },
    {
      name: 'ogrn',
      type: 'text',
      label: 'ОГРН',
    },
    {
      name: 'legalAddress',
      type: 'text',
      label: 'Юридический адрес',
    },
    {
      name: 'privacyEmail',
      type: 'email',
      label: 'Адрес для обращений по персональным данным',
      admin: {
        description:
          'Сюда пациент направляет отзыв согласия и требование об удалении данных о здоровье: по этим данным оператор - организация, а не платформа.',
      },
    },
    {
      name: 'licenceNumber',
      type: 'text',
      label: 'Номер лицензии на медицинскую деятельность',
      admin: {
        description: 'Медицинскую услугу оказывает организация по своей лицензии, а не платформа.',
      },
    },
    {
      name: 'licenceIssuedBy',
      type: 'text',
      label: 'Кем выдана лицензия',
    },
    {
      name: 'licenceIssuedAt',
      type: 'date',
      label: 'Дата выдачи лицензии',
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
  ],
}
