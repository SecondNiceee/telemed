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
  upload: true,
}
