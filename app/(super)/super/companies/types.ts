export interface CompanyDirectoryRow {
  id: string
  name: string
  slug: string
  customDomain: string | null
  isAgency: boolean
  createdAt: Date
  memberCount: number
  ownerName: string | null
}

export interface CompanyDirectoryData {
  items: CompanyDirectoryRow[]
  total: number
  page: number
  totalPages: number
}

export type CompanyDirectorySort = 'name' | 'members' | 'createdAt'
export type SortDirection = 'asc' | 'desc'
export type CompanyKindFilter = 'all' | 'agency' | 'sub'

export interface CompanyDirectoryQuery {
  search: string
  kind: CompanyKindFilter
  sort: CompanyDirectorySort
  direction: SortDirection
  page: number
}

export const COMPANY_DIRECTORY_PAGE_SIZE = 20
