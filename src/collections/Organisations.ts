import type { CollectionConfig, PayloadRequest } from 'payload'
import { getCallerFromRequest } from './helpers/auth'


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
  ],
}
