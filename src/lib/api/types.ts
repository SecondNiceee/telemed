export interface ApiCategory {
  id: number
  name: string
  slug: string
  description?: string | null
  icon?: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiMedia {
  id: number
  alt: string
  url?: string | null
  thumbnailURL?: string | null
  filename?: string | null
  mimeType?: string | null
  width?: number | null
  height?: number | null
}

export interface ApiEducationItem {
  value?: string | null
  id?: string
}

export interface ApiServiceItem {
  value?: string | null
  id?: string
}

export interface ApiOrganisation {
  id: number
  name: string
  email: string
  createdAt: string
  updatedAt: string
}

export interface DoctorScheduleSlot {
  time: string
  id?: string
}

export interface DoctorScheduleDate {
  date: string // YYYY-MM-DD
  slots: DoctorScheduleSlot[]
  id?: string
}

export interface ApiDoctor {
  id: number
  email: string
  name?: string | null
  organisation?: ApiOrganisation | number | null
  categories?: (ApiCategory | number)[] | null
  experience?: number | null
  degree?: string | null
  price?: number | null
  photo?: ApiMedia | number | null
  bio?: string | null
  education?: ApiEducationItem[] | null
  services?: ApiServiceItem[] | null
  slotDuration?: string | null
  schedule?: DoctorScheduleDate[] | null
  createdAt: string
  updatedAt: string
}

export interface ApiAppointment {
  id: number
  doctor: ApiDoctor | number
  user: { id: number; name?: string | null; email: string } | number
  doctorName?: string | null
  userName?: string | null
  specialty?: string | null
  date: string // YYYY-MM-DD
  time: string // HH:MM
  price?: number | null
  status: 'confirmed' | 'completed' | 'cancelled'
  createdAt: string
  updatedAt: string
}

export interface PayloadListResponse<T> {
  docs: T[]
  totalDocs: number
  limit: number
  totalPages: number
  page: number
  pagingCounter: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevPage: number | null
  nextPage: number | null
}
