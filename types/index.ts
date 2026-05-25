// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// User Types
export interface User {
  id: string
  email: string
  role: "admin" | "member"
  createdAt: Date
  updatedAt: Date
}

// Pagination Types
export interface PaginationParams {
  page: number
  limit: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Common Props
export interface ChildrenProps {
  children: React.ReactNode
}

export interface ClassNameProps {
  className?: string
}

export interface BaseComponentProps extends ChildrenProps, ClassNameProps {}
