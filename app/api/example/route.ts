import { type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  successResponse,
  validateBody,
  validateSearchParams,
  withErrorHandling,
  paginatedResult,
} from '@/lib/api'
import { paginationSchema } from '@/lib/validations'

const createItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).max(10).default([]),
})

// GET /api/example — paginated list (mock data)
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)

  const validation = validateSearchParams(searchParams, paginationSchema)
  if (validation.error) return validation.error

  const { page, limit } = validation.data

  const items = [
    { id: '1', name: 'Item 1', description: 'Description 1' },
    { id: '2', name: 'Item 2', description: 'Description 2' },
  ]
  const total = 100

  return successResponse(paginatedResult(items, total, page, limit))
})

// POST /api/example — create with body validation (mock data)
export const POST = withErrorHandling(async (request: NextRequest) => {
  const validation = await validateBody(request, createItemSchema)
  if (validation.error) return validation.error

  const { name, description, tags } = validation.data

  const newItem = {
    id: 'new-id',
    name,
    description: description ?? null,
    tags,
    createdAt: new Date(),
  }

  return successResponse(newItem, 201)
})
