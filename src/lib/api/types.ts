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
