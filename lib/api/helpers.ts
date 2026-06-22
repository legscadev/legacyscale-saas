import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

// ============================================
// RESPONSE HELPERS
// ============================================

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function errorResponse(
  message: string,
  status = 400,
  details?: Record<string, string[]>
) {
  return NextResponse.json(
    { success: false, error: { message, details } },
    { status }
  )
}

export function validationErrorResponse(error: ZodError) {
  const details: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const path = issue.path.join('.')
    if (!details[path]) {
      details[path] = []
    }
    details[path].push(issue.message)
  }

  return errorResponse('Validation failed', 400, details)
}

export function notFoundResponse(resource = 'Resource') {
  return errorResponse(`${resource} not found`, 404)
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return errorResponse(message, 401)
}

export function forbiddenResponse(message = 'Access denied') {
  return errorResponse(message, 403)
}

export function serverErrorResponse(message = 'Internal server error') {
  return errorResponse(message, 500)
}

// ============================================
// VALIDATION HELPERS
// ============================================

type ValidationResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: NextResponse }

export async function validateBody<S extends z.ZodType>(
  request: Request,
  schema: S
): Promise<ValidationResult<z.infer<S>>> {
  try {
    const body = await request.json()
    return { data: schema.parse(body) }
  } catch (error) {
    if (error instanceof ZodError) {
      return { error: validationErrorResponse(error) }
    }
    if (error instanceof SyntaxError) {
      return { error: errorResponse('Invalid JSON body') }
    }
    return { error: serverErrorResponse() }
  }
}

export function validateParams<S extends z.ZodType>(
  params: unknown,
  schema: S
): ValidationResult<z.infer<S>> {
  try {
    return { data: schema.parse(params) }
  } catch (error) {
    if (error instanceof ZodError) {
      return { error: validationErrorResponse(error) }
    }
    return { error: serverErrorResponse() }
  }
}

export function validateSearchParams<S extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: S
): ValidationResult<z.infer<S>> {
  try {
    const params: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      params[key] = value
    })
    return { data: schema.parse(params) }
  } catch (error) {
    if (error instanceof ZodError) {
      return { error: validationErrorResponse(error) }
    }
    return { error: serverErrorResponse() }
  }
}

// ============================================
// PAGINATION
// ============================================

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasMore: boolean
}

export function paginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit)
  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
  }
}

// ============================================
// ERROR-HANDLING WRAPPER
// ============================================

// Preserves the wrapped handler's exact signature so it stays a valid
// Next.js route handler (no synthetic context param is introduced).
type ApiHandler<Args extends unknown[]> = (
  ...args: Args
) => Promise<NextResponse>

/**
 * Some Next.js helpers (`redirect`, `notFound`) signal navigation
 * by *throwing* a special error. Next catches it upstream of the
 * route handler and emits the right HTTP response. If our wrapper
 * swallows that throw, the navigation never happens and the caller
 * gets a 500 instead. This detects both signal types by their
 * known `digest` prefix so we can re-throw them unchanged.
 */
function isNextNavigationError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const digest = (error as { digest?: unknown }).digest
  if (typeof digest !== 'string') return false
  return (
    digest.startsWith('NEXT_REDIRECT;') ||
    digest.startsWith('NEXT_HTTP_ERROR_FALLBACK;')
  )
}

export function withErrorHandling<Args extends unknown[]>(
  handler: ApiHandler<Args>
): ApiHandler<Args> {
  return async (...args: Args) => {
    try {
      return await handler(...args)
    } catch (error) {
      // Let redirect()/notFound() reach Next's renderer untouched.
      if (isNextNavigationError(error)) throw error

      console.error('API Error:', error)

      if (error instanceof ZodError) {
        return validationErrorResponse(error)
      }

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return notFoundResponse()
        }
        if (
          error.message.includes('unauthorized') ||
          error.message.includes('not authenticated')
        ) {
          return unauthorizedResponse()
        }
        if (
          error.message.includes('forbidden') ||
          error.message.includes('not authorized')
        ) {
          return forbiddenResponse()
        }
      }

      return serverErrorResponse()
    }
  }
}
