import type { CollectionConfig, PayloadRequest } from 'payload'
import { getCallerFromRequest } from './helpers/auth';

const checkAccessCookie = ({req} : {req:PayloadRequest}) => {
  const user = getCallerFromRequest(req, "users");
  if (user?.role === "admin") return true;
  // Allow regular users to upload files (for chat attachments)
  if (user?.collection === "users") return true;
  const organisation = getCallerFromRequest(req, "organisations");
  if (organisation?.collection === "organisations") return true;
  const doctor = getCallerFromRequest(req, 'doctors');
  if (doctor?.collection === "doctors") return true;

  console.error('[media] access DENIED — no recognised caller cookie', {
    hasCookieHeader: Boolean(req?.headers?.get?.('cookie')),
  })
  return false 
}

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: checkAccessCookie,
    update: checkAccessCookie,
    delete: checkAccessCookie
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: false,
    },
  ],
  hooks: {
    beforeOperation: [
      ({ operation, req }) => {
        if (operation === 'create') {
          const file = (req as unknown as { file?: { name?: string; mimetype?: string; size?: number } }).file
          console.log('[media] create incoming', {
            filename: file?.name,
            mimeType: file?.mimetype,
            size: file?.size,
          })
        }
      },
    ],
    afterChange: [
      ({ doc, operation }) => {
        const d = doc as unknown as { id?: number | string; filename?: string; mimeType?: string; filesize?: number }
        console.log('[media] afterChange', {
          operation,
          id: d?.id,
          filename: d?.filename,
          mimeType: d?.mimeType,
          filesize: d?.filesize,
        })
      },
    ],
  },
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf'],
    filesRequiredOnCreate: false,
  },
}
