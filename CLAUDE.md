# Legacy Scale Engineering Standards

## Overview

This document defines the engineering standards, conventions, and best practices for the Legacy Scale platform. Every developer on this project must follow these guidelines to ensure code quality, maintainability, scalability, and a premium user experience.

**Tech Stack:** Next.js 14 | TypeScript | Supabase | Prisma | TailwindCSS | ShadCN/UI

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Code Quality Standards](#code-quality-standards)
3. [Frontend Standards](#frontend-standards)
4. [Backend Standards](#backend-standards)
5. [Database Standards](#database-standards)
6. [API Design Standards](#api-design-standards)
7. [UI/UX Standards](#uiux-standards)
8. [TypeScript Standards](#typescript-standards)
9. [Security Standards](#security-standards)
10. [Performance Standards](#performance-standards)
11. [Testing Standards](#testing-standards)
12. [Git Workflow](#git-workflow)
13. [Naming Conventions](#naming-conventions)
14. [File & Folder Structure](#file--folder-structure)

---

## Core Principles

### 1. Reusable Components Over Duplication

**Rule:** Always prefer reusable components over duplicated UI or logic.

```tsx
// BAD: Duplicated card pattern across multiple files
function CoursePage() {
  return (
    <div className="rounded-lg border p-4 hover:shadow-lg transition-shadow">
      <h3 className="font-semibold">{course.title}</h3>
      <p className="text-muted-foreground">{course.description}</p>
    </div>
  )
}

// GOOD: Extract into reusable component
import { ContentCard } from '@/components/shared/content-card'

function CoursePage() {
  return (
    <ContentCard
      title={course.title}
      description={course.description}
      href={`/courses/${course.id}`}
    />
  )
}
```

**Guidelines:**
- Extract repeated patterns into shared components, hooks, services, or utilities
- Use composition over duplication
- Create variants using props, not separate components
- Document reusable components with JSDoc comments

### 2. Single Responsibility Principle (SRP)

**Rule:** A function should do exactly one thing.

```tsx
// BAD: Function does too many things
async function handleSubmit(formData: FormData) {
  // Validates
  const email = formData.get('email')
  if (!email || !email.includes('@')) throw new Error('Invalid email')

  // Formats
  const formatted = email.toLowerCase().trim()

  // Calls API
  const response = await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({ email: formatted })
  })

  // Shows toast
  toast.success('User created!')

  // Redirects
  router.push('/users')
}

// GOOD: Separated concerns
function validateEmail(email: string): boolean {
  return emailSchema.safeParse(email).success
}

function formatEmail(email: string): string {
  return email.toLowerCase().trim()
}

async function createUser(email: string): Promise<User> {
  return apiClient.post('/users', { email })
}

async function handleSubmit(formData: FormData) {
  const email = formData.get('email') as string

  if (!validateEmail(email)) {
    toast.error('Invalid email')
    return
  }

  await createUser(formatEmail(email))
  toast.success('User created!')
  router.push('/users')
}
```

### 3. Function Length

**Target:**
- Ideal: 5–20 lines
- Maximum: 30 lines
- Refactor required: 30+ lines

```tsx
// BAD: 50+ line function
function processOrder(order: Order) {
  // ... 50 lines of mixed validation, calculation, API calls, formatting
}

// GOOD: Composed small functions
function processOrder(order: Order) {
  validateOrder(order)
  const totals = calculateTotals(order)
  const formatted = formatOrderForAPI(order, totals)
  return submitOrder(formatted)
}
```

### 4. File Length

**Target:**
- Ideal: 100–300 lines
- Warning: 300+ lines
- Refactor required: 500+ lines

**When a file exceeds limits:**
- Split into modules
- Extract components/hooks/services
- Create separate type definition files
- Move constants to dedicated files

### 5. Line Length

**Target:** 80–120 characters maximum

**Rationale:**
- Improves readability
- Easier code reviews
- Cleaner git diffs
- Better side-by-side comparisons

```tsx
// BAD: Long line
const user = await prisma.user.findFirst({ where: { email: formData.get('email'), isActive: true, role: 'ADMIN' }, include: { enrollments: true, lessonProgress: true } })

// GOOD: Formatted for readability
const user = await prisma.user.findFirst({
  where: {
    email: formData.get('email'),
    isActive: true,
    role: 'ADMIN',
  },
  include: {
    enrollments: true,
    lessonProgress: true,
  },
})
```

---

## Code Quality Standards

### DRY (Don't Repeat Yourself)

```tsx
// BAD: Repeated logic
function getAdminGreeting(name: string) {
  const hour = new Date().getHours()
  if (hour < 12) return `Good morning, Admin ${name}`
  if (hour < 18) return `Good afternoon, Admin ${name}`
  return `Good evening, Admin ${name}`
}

function getMemberGreeting(name: string) {
  const hour = new Date().getHours()
  if (hour < 12) return `Good morning, ${name}`
  if (hour < 18) return `Good afternoon, ${name}`
  return `Good evening, ${name}`
}

// GOOD: Extracted utility
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

function getGreeting(name: string, prefix?: string): string {
  const timeOfDay = getTimeOfDay()
  const displayName = prefix ? `${prefix} ${name}` : name
  return `Good ${timeOfDay}, ${displayName}`
}
```

### KISS (Keep It Simple, Stupid)

```tsx
// BAD: Overengineered
class UserNameFormatterFactory {
  private formatters: Map<string, Formatter> = new Map()

  registerFormatter(type: string, formatter: Formatter) {
    this.formatters.set(type, formatter)
  }

  format(user: User, type: string): string {
    return this.formatters.get(type)?.format(user) ?? user.name
  }
}

// GOOD: Simple function
function formatUserName(user: User): string {
  return user.name || user.email.split('@')[0]
}
```

### Readability First

```tsx
// BAD: Clever but unreadable
const r = d.filter(x => x.s === 'A' && x.t > Date.now() - 864e5).map(x => ({...x, f: true}))

// GOOD: Clear and readable
const activeRecentData = data
  .filter(item => item.status === 'ACTIVE')
  .filter(item => item.timestamp > oneDayAgo)
  .map(item => ({ ...item, flagged: true }))
```

### Self-Documenting Code

```tsx
// BAD: Requires comment to understand
// Check if user can access premium content
if (u.r === 'A' || (u.s && u.e > Date.now())) {
  // ...
}

// GOOD: Self-documenting
const isAdmin = user.role === 'ADMIN'
const hasActiveSubscription = user.subscription && user.subscriptionExpiry > Date.now()
const canAccessPremiumContent = isAdmin || hasActiveSubscription

if (canAccessPremiumContent) {
  // ...
}
```

### Comments: When and How

**Use comments for:**
- Complex business logic explanation
- Why something is done (not what)
- TODO items with ticket references
- JSDoc for public APIs

**Avoid comments for:**
- Explaining what code does (refactor instead)
- Commented-out code (delete it)
- Obvious statements

```tsx
// BAD: Obvious comment
// Loop through users
for (const user of users) {
  // Check if user is active
  if (user.isActive) {
    // Add to active users array
    activeUsers.push(user)
  }
}

// GOOD: Comment explains "why"
// Filter out users who haven't completed onboarding, as they
// shouldn't receive marketing emails per GDPR compliance
const eligibleUsers = users.filter(user =>
  user.isActive && user.onboardingCompleted
)
```

---

## Frontend Standards

### React Architecture

#### Component Structure

```tsx
// Component file structure
'use client' // Only if needed

import { useState, useEffect } from 'react'           // 1. React imports
import { useRouter } from 'next/navigation'           // 2. Next.js imports
import { useQuery } from '@tanstack/react-query'      // 3. External libraries
import { Button } from '@/components/ui/button'       // 4. UI components
import { formatDate } from '@/lib/utils'              // 5. Internal utilities
import { CourseCard } from './course-card'            // 6. Local components
import type { Course } from '@/types'                 // 7. Types

// Types/Interfaces
interface CourseListProps {
  userId: string
  showProgress?: boolean
}

// Component
export function CourseList({ userId, showProgress = true }: CourseListProps) {
  // 1. Hooks (in order: state, refs, context, custom hooks, effects)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const router = useRouter()
  const { data: courses, isLoading } = useCourses(userId)

  // 2. Derived state
  const hasCorses = courses && courses.length > 0

  // 3. Event handlers
  const handleSelect = (id: string) => {
    setSelectedId(id)
    router.push(`/courses/${id}`)
  }

  // 4. Early returns (loading, error, empty states)
  if (isLoading) return <CourseListSkeleton />
  if (!hasCourses) return <EmptyState message="No courses found" />

  // 5. Main render
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {courses.map(course => (
        <CourseCard
          key={course.id}
          course={course}
          showProgress={showProgress}
          onSelect={handleSelect}
        />
      ))}
    </div>
  )
}
```

#### Custom Hooks

```tsx
// hooks/use-courses.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { courseApi } from '@/lib/api/courses'
import type { Course, CreateCourseInput } from '@/types'

export function useCourses(userId?: string) {
  return useQuery({
    queryKey: ['courses', userId],
    queryFn: () => courseApi.list(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useCourse(courseId: string) {
  return useQuery({
    queryKey: ['courses', courseId],
    queryFn: () => courseApi.get(courseId),
    enabled: !!courseId,
  })
}

export function useCreateCourse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCourseInput) => courseApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] })
    },
  })
}
```

### State Management

**Use the right tool for the job:**

| State Type | Solution |
|------------|----------|
| Server state | TanStack Query |
| Form state | React Hook Form |
| UI state (local) | useState |
| UI state (shared) | Zustand |
| URL state | useSearchParams |

```tsx
// Zustand store example
import { create } from 'zustand'

interface SidebarStore {
  isCollapsed: boolean
  toggle: () => void
  setCollapsed: (collapsed: boolean) => void
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isCollapsed: false,
  toggle: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
}))
```

### Forms & Validation

```tsx
// Use React Hook Form + Zod for all forms
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createCourseSchema, type CreateCourseInput } from '@/lib/validations'

export function CreateCourseForm() {
  const form = useForm<CreateCourseInput>({
    resolver: zodResolver(createCourseSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'DRAFT',
    },
  })

  const { mutate: createCourse, isPending } = useCreateCourse()

  const onSubmit = (data: CreateCourseInput) => {
    createCourse(data, {
      onSuccess: () => {
        toast.success('Course created')
        form.reset()
      },
      onError: (error) => {
        toast.error(error.message)
      },
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Course title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating...' : 'Create Course'}
        </Button>
      </form>
    </Form>
  )
}
```

### TailwindCSS Guidelines

```tsx
// Use consistent spacing scale
// 1, 2, 3, 4, 6, 8, 12, 16, 24, 32

// BAD: Arbitrary values
<div className="p-[13px] m-[7px] gap-[9px]">

// GOOD: Design system values
<div className="p-3 m-2 gap-2">

// Use semantic color tokens
// BAD: Hardcoded colors
<p className="text-[#666666]">

// GOOD: Semantic tokens
<p className="text-muted-foreground">

// Group related utilities logically
// BAD: Random order
<div className="hover:bg-accent p-4 flex rounded-lg border items-center gap-2 transition-colors">

// GOOD: Logical grouping (layout → spacing → visual → interactive)
<div className="flex items-center gap-2 p-4 rounded-lg border transition-colors hover:bg-accent">

// Extract repeated patterns
// BAD: Repeated class strings
<Button className="flex items-center gap-2 px-4 py-2 text-sm font-medium">
<Button className="flex items-center gap-2 px-4 py-2 text-sm font-medium">

// GOOD: Use cn() and variants
const buttonVariants = cva(
  'flex items-center gap-2 px-4 py-2 text-sm font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        outline: 'border border-input bg-background',
      },
    },
  }
)
```

### Error Handling

```tsx
// Use error boundaries for component trees
'use client'

import { ErrorBoundary } from 'react-error-boundary'

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h2 className="mt-4 text-lg font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <Button onClick={resetErrorBoundary} className="mt-4">
        Try again
      </Button>
    </div>
  )
}

export function CourseSection() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <CourseList />
    </ErrorBoundary>
  )
}
```

### Loading States

```tsx
// Always provide loading states
// Use Suspense + loading.tsx for route-level loading
// Use skeleton components for inline loading

// Skeleton example
export function CourseCardSkeleton() {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}

// Usage with TanStack Query
function CourseList() {
  const { data, isLoading, error } = useCourses()

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CourseCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (error) return <ErrorState error={error} />
  if (!data?.length) return <EmptyState />

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {data.map(course => <CourseCard key={course.id} course={course} />)}
    </div>
  )
}
```

---

## Backend Standards

### API Route Structure

```tsx
// app/api/courses/route.ts
import { NextRequest } from 'next/server'
import { requireAdmin, requireUser } from '@/lib/auth'
import { validateBody, successResponse, errorResponse, paginatedResult } from '@/lib/api'
import { createCourseSchema, paginationSchema } from '@/lib/validations'
import { courseService } from '@/lib/services/course-service'

// GET /api/courses - List courses
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser()
    const { searchParams } = new URL(request.url)

    const { page, limit } = paginationSchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    })

    const { courses, total } = await courseService.list({
      userId: user.id,
      page,
      limit,
    })

    return successResponse(paginatedResult(courses, total, page, limit))
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/courses - Create course
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const validation = await validateBody(request, createCourseSchema)
    if (validation.error) return validation.error

    const course = await courseService.create(validation.data)

    return successResponse(course, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
```

### Service Layer

```tsx
// lib/services/course-service.ts
import { prisma } from '@/lib/prisma'
import type { CreateCourseInput, UpdateCourseInput } from '@/lib/validations'

class CourseService {
  async list(options: { userId?: string; page: number; limit: number }) {
    const { userId, page, limit } = options
    const skip = (page - 1) * limit

    const where = userId ? { enrollments: { some: { userId } } } : {}

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { orderIndex: 'asc' },
        include: {
          _count: { select: { chapters: true } },
        },
      }),
      prisma.course.count({ where }),
    ])

    return { courses, total }
  }

  async get(id: string) {
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { orderIndex: 'asc' },
          include: {
            lessons: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    })

    if (!course) {
      throw new NotFoundError('Course not found')
    }

    return course
  }

  async create(data: CreateCourseInput) {
    return prisma.course.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status,
        orderIndex: await this.getNextOrderIndex(),
      },
    })
  }

  async update(id: string, data: UpdateCourseInput) {
    await this.get(id) // Throws if not found

    return prisma.course.update({
      where: { id },
      data,
    })
  }

  async delete(id: string) {
    await this.get(id) // Throws if not found

    return prisma.course.delete({
      where: { id },
    })
  }

  private async getNextOrderIndex(): Promise<number> {
    const lastCourse = await prisma.course.findFirst({
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    })
    return (lastCourse?.orderIndex ?? -1) + 1
  }
}

export const courseService = new CourseService()
```

### Error Handling

```tsx
// lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND')
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', public details?: Record<string, string[]>) {
    super(message, 400, 'VALIDATION_ERROR')
  }
}

// lib/api/error-handler.ts
export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error)

  if (error instanceof AppError) {
    return errorResponse(error.message, error.statusCode)
  }

  if (error instanceof ZodError) {
    return validationErrorResponse(error)
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      return notFoundResponse()
    }
    if (error.code === 'P2002') {
      return errorResponse('A record with this value already exists', 409)
    }
  }

  return serverErrorResponse()
}
```

### Thin Controllers

```tsx
// BAD: Fat controller with business logic
export async function POST(request: NextRequest) {
  const body = await request.json()

  // Validation in controller
  if (!body.email || !body.email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  // Business logic in controller
  const existingUser = await prisma.user.findUnique({ where: { email: body.email } })
  if (existingUser) {
    return NextResponse.json({ error: 'User exists' }, { status: 409 })
  }

  // Database operations in controller
  const user = await prisma.user.create({
    data: {
      email: body.email.toLowerCase().trim(),
      name: body.name,
      role: 'MEMBER',
    },
  })

  // Side effects in controller
  await sendWelcomeEmail(user.email, user.name)

  return NextResponse.json(user, { status: 201 })
}

// GOOD: Thin controller delegating to service
export async function POST(request: NextRequest) {
  try {
    const validation = await validateBody(request, createUserSchema)
    if (validation.error) return validation.error

    const user = await userService.create(validation.data)

    return successResponse(user, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
```

---

## Database Standards

### Naming Conventions

```sql
-- Tables: snake_case, plural
users, courses, lesson_progress, quiz_attempts

-- Columns: snake_case
user_id, created_at, is_active, order_index

-- Foreign keys: referenced_table_id (singular)
user_id, course_id, chapter_id

-- Indexes: idx_table_column(s)
idx_users_email, idx_enrollments_user_course

-- Primary keys: id (UUID)
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

### Prisma Schema Conventions

```prisma
// Use @map for snake_case database columns
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  avatarUrl String?  @map("avatar_url")  // camelCase in code, snake_case in DB
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  enrollments Enrollment[]

  @@map("users")  // Table name in snake_case
}
```

### Query Optimization

```tsx
// BAD: SELECT * equivalent
const users = await prisma.user.findMany()

// GOOD: Select only needed fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    name: true,
  },
})

// BAD: N+1 query
const courses = await prisma.course.findMany()
for (const course of courses) {
  const chapters = await prisma.chapter.findMany({
    where: { courseId: course.id },
  })
}

// GOOD: Eager loading
const courses = await prisma.course.findMany({
  include: {
    chapters: {
      orderBy: { orderIndex: 'asc' },
    },
  },
})

// GOOD: Use _count for counts
const courses = await prisma.course.findMany({
  include: {
    _count: {
      select: { chapters: true, enrollments: true },
    },
  },
})
```

### Pagination

```tsx
// Always paginate list endpoints
async function listUsers(page: number, limit: number) {
  const skip = (page - 1) * limit

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count(),
  ])

  return {
    items: users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasMore: page * limit < total,
  }
}
```

### Transactions

```tsx
// Use transactions for related operations
async function enrollUserInCourse(userId: string, courseId: string) {
  return prisma.$transaction(async (tx) => {
    // Create enrollment
    const enrollment = await tx.enrollment.create({
      data: { userId, courseId },
    })

    // Initialize progress for all lessons
    const lessons = await tx.lesson.findMany({
      where: { chapter: { courseId } },
      select: { id: true },
    })

    await tx.lessonProgress.createMany({
      data: lessons.map(lesson => ({
        userId,
        lessonId: lesson.id,
        completed: false,
      })),
    })

    return enrollment
  })
}
```

### Indexes

```prisma
// Add indexes for frequently queried columns
model Enrollment {
  id       String @id @default(uuid())
  userId   String @map("user_id")
  courseId String @map("course_id")

  @@unique([userId, courseId])
  @@index([userId])
  @@index([courseId])
  @@map("enrollments")
}
```

---

## API Design Standards

### Response Format

```tsx
// Success response
{
  "success": true,
  "data": { ... }
}

// Error response
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "email": ["Invalid email address"],
      "password": ["Must be at least 8 characters"]
    }
  }
}

// Paginated response
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasMore": true
  }
}
```

### HTTP Methods

| Method | Purpose | Idempotent |
|--------|---------|------------|
| GET | Retrieve resources | Yes |
| POST | Create resources | No |
| PUT | Replace resources | Yes |
| PATCH | Partial update | Yes |
| DELETE | Remove resources | Yes |

### Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation errors |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Not authorized |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource |
| 422 | Unprocessable | Business logic error |
| 500 | Server Error | Unexpected error |

### URL Structure

```
GET    /api/courses              # List courses
POST   /api/courses              # Create course
GET    /api/courses/:id          # Get course
PATCH  /api/courses/:id          # Update course
DELETE /api/courses/:id          # Delete course
GET    /api/courses/:id/chapters # List chapters in course
POST   /api/courses/:id/chapters # Create chapter in course
```

---

## UI/UX Standards

### Premium UI Requirements

Every interface must feel:
- **Modern:** Current design trends, not dated
- **Clean:** Minimal clutter, clear hierarchy
- **Polished:** Attention to detail, no rough edges
- **Responsive:** Works on all screen sizes
- **Intentional:** Every element has a purpose
- **Production-ready:** No placeholders, no "TODO"s visible

### Required States

Every interactive element must have:

```tsx
// Button states
<Button
  className={cn(
    // Base
    'transition-all duration-200',
    // Hover
    'hover:bg-primary/90',
    // Focus
    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
    // Active
    'active:scale-[0.98]',
    // Disabled
    'disabled:opacity-50 disabled:cursor-not-allowed',
    // Loading
    isLoading && 'cursor-wait'
  )}
>
  {isLoading ? <Loader2 className="animate-spin" /> : children}
</Button>
```

### Visual Hierarchy

```tsx
// Use consistent typography scale
<h1 className="text-4xl font-bold tracking-tight">   {/* Page title */}
<h2 className="text-2xl font-semibold">              {/* Section heading */}
<h3 className="text-xl font-medium">                 {/* Card title */}
<p className="text-base text-muted-foreground">      {/* Body text */}
<span className="text-sm text-muted-foreground">     {/* Secondary text */}
<span className="text-xs text-muted-foreground">     {/* Caption */}
```

### Spacing System

```tsx
// Use consistent spacing
// 4px increments: 1, 2, 3, 4, 6, 8, 12, 16, 20, 24

// Component internal padding
<Card className="p-4">       {/* 16px */}
<Card className="p-6">       {/* 24px - default */}

// Section spacing
<section className="space-y-6">  {/* 24px between sections */}

// Element spacing
<div className="space-y-4">      {/* 16px between elements */}

// Inline spacing
<div className="gap-2">          {/* 8px between inline items */}
```

### Loading UX

```tsx
// Show loading immediately
// Use skeleton that matches content shape
// Maintain layout stability (no jumps)

function CourseList() {
  const { data, isLoading } = useCourses()

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CourseCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {data?.map(course => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  )
}
```

### Empty States

```tsx
// Every list needs an empty state
function CourseList({ courses }) {
  if (courses.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No courses yet"
        description="Get started by creating your first course."
        action={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Course
          </Button>
        }
      />
    )
  }

  return (/* ... */)
}
```

### Animations & Transitions

```tsx
// Subtle transitions for state changes
<div className="transition-colors duration-200 hover:bg-accent">

// Scale for clickable items
<button className="transition-transform active:scale-[0.98]">

// Fade for appearing content
<div className="animate-in fade-in duration-200">

// Slide for modals/sheets
<Sheet className="animate-in slide-in-from-right duration-300">
```

### Accessibility

```tsx
// Always include
<Button aria-label="Close dialog">
  <X className="h-4 w-4" />
</Button>

// Focus management
<Dialog onOpenAutoFocus={(e) => e.preventDefault()}>

// Screen reader text
<span className="sr-only">Loading</span>

// Keyboard navigation
<div role="listbox" onKeyDown={handleKeyDown}>

// Color contrast
// Minimum 4.5:1 for normal text
// Minimum 3:1 for large text
```

---

## TypeScript Standards

### Type Definitions

```tsx
// Use interfaces for objects that can be extended
interface User {
  id: string
  email: string
  name: string | null
}

// Use types for unions, intersections, primitives
type Status = 'pending' | 'active' | 'completed'
type ID = string
type Handler = (event: Event) => void

// Use Zod inference for validation schemas
import { z } from 'zod'

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
})

type UserInput = z.infer<typeof userSchema>
```

### Strict Mode

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### Avoid Any

```tsx
// BAD
function process(data: any) {
  return data.value
}

// GOOD
function process<T extends { value: unknown }>(data: T) {
  return data.value
}

// GOOD: Use unknown for truly unknown data
function processUnknown(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return data.value
  }
  throw new Error('Invalid data')
}
```

### Discriminated Unions

```tsx
// Use discriminated unions for state
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }

function renderState<T>(state: AsyncState<T>) {
  switch (state.status) {
    case 'idle':
      return null
    case 'loading':
      return <Loading />
    case 'success':
      return <Data data={state.data} />
    case 'error':
      return <Error error={state.error} />
  }
}
```

---

## Security Standards

### Input Validation

```tsx
// ALWAYS validate all inputs
// Use Zod for schema validation
import { z } from 'zod'

const createUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100).trim(),
  password: z.string().min(8).max(100),
})

// Validate in API routes
export async function POST(request: NextRequest) {
  const validation = await validateBody(request, createUserSchema)
  if (validation.error) return validation.error

  // validation.data is now type-safe and validated
}
```

### SQL Injection Prevention

```tsx
// ALWAYS use Prisma's parameterized queries
// NEVER concatenate user input into queries

// BAD
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = '${email}'
`

// GOOD
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${email}
`

// BEST: Use Prisma's type-safe queries
const user = await prisma.user.findUnique({
  where: { email },
})
```

### XSS Prevention

```tsx
// React automatically escapes content
// Be careful with dangerouslySetInnerHTML

// BAD
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// GOOD: Use a sanitizer if HTML is required
import DOMPurify from 'dompurify'

<div
  dangerouslySetInnerHTML={{
    __html: DOMPurify.sanitize(userContent)
  }}
/>

// BEST: Avoid HTML, use markdown
import ReactMarkdown from 'react-markdown'

<ReactMarkdown>{userContent}</ReactMarkdown>
```

### Authentication

```tsx
// Use Supabase Auth with proper session management
// Always verify sessions server-side

export async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Also verify in database
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  })

  if (!dbUser || !dbUser.isActive) {
    redirect('/login')
  }

  return dbUser
}
```

### Authorization

```tsx
// Check permissions at every access point

export async function requireAdmin() {
  const user = await requireUser()

  if (user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  return user
}

// Resource-level authorization
async function getEnrollment(userId: string, courseId: string) {
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: { userId, courseId },
    },
  })

  if (!enrollment) {
    throw new ForbiddenError('You are not enrolled in this course')
  }

  return enrollment
}
```

### Secrets Management

```tsx
// NEVER commit secrets to git
// Use environment variables

// .env.local (never committed)
SUPABASE_SERVICE_ROLE_KEY=your-secret-key
DATABASE_URL=postgresql://...

// Access via process.env
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Server-only
)

// Validate required env vars at startup
function validateEnv() {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'DATABASE_URL',
  ]

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  }
}
```

---

## Performance Standards

### Frontend Performance

```tsx
// Use dynamic imports for code splitting
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('./heavy-component'), {
  loading: () => <Skeleton />,
})

// Memoize expensive calculations
const expensiveValue = useMemo(() => {
  return data.filter(item => complexFilter(item))
}, [data])

// Memoize callbacks passed to children
const handleClick = useCallback((id: string) => {
  setSelected(id)
}, [])

// Use React.memo for pure components
const ExpensiveList = React.memo(function ExpensiveList({ items }) {
  return items.map(item => <Item key={item.id} item={item} />)
})
```

### Image Optimization

```tsx
// Always use next/image
import Image from 'next/image'

<Image
  src={course.thumbnailUrl}
  alt={course.title}
  width={640}
  height={360}
  className="object-cover"
  priority={isAboveFold}  // Only for above-fold images
/>

// Use blur placeholder for better UX
<Image
  src={url}
  alt={alt}
  placeholder="blur"
  blurDataURL={blurDataUrl}
/>
```

### API Performance

```tsx
// Use parallel requests where possible
const [courses, announcements, progress] = await Promise.all([
  courseService.list(),
  announcementService.list(),
  progressService.getUserProgress(userId),
])

// Cache expensive queries
import { unstable_cache } from 'next/cache'

const getCachedCourses = unstable_cache(
  async () => courseService.list(),
  ['courses'],
  { revalidate: 60 } // 1 minute
)

// Use stale-while-revalidate on client
const { data } = useQuery({
  queryKey: ['courses'],
  queryFn: fetchCourses,
  staleTime: 5 * 60 * 1000, // 5 minutes
})
```

### Database Performance

```tsx
// Select only needed fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
  },
})

// Use indexes for filtered/sorted queries
@@index([status, createdAt])

// Avoid N+1 with includes
const courses = await prisma.course.findMany({
  include: {
    chapters: {
      include: { lessons: true },
    },
  },
})

// Use raw queries for complex aggregations
const stats = await prisma.$queryRaw`
  SELECT
    course_id,
    COUNT(*) as enrollment_count,
    AVG(progress) as avg_progress
  FROM enrollments
  GROUP BY course_id
`
```

---

## Testing Standards

### Unit Tests

```tsx
// tests/lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { formatDuration, calculateProgress } from '@/lib/utils'

describe('formatDuration', () => {
  it('formats seconds to mm:ss', () => {
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3600)).toBe('60:00')
  })

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('handles negative values', () => {
    expect(formatDuration(-10)).toBe('0:00')
  })
})

describe('calculateProgress', () => {
  it('calculates percentage correctly', () => {
    expect(calculateProgress(5, 10)).toBe(50)
    expect(calculateProgress(0, 10)).toBe(0)
    expect(calculateProgress(10, 10)).toBe(100)
  })

  it('handles division by zero', () => {
    expect(calculateProgress(5, 0)).toBe(0)
  })
})
```

### Component Tests

```tsx
// tests/components/course-card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { CourseCard } from '@/components/course-card'

describe('CourseCard', () => {
  const mockCourse = {
    id: '1',
    title: 'Test Course',
    description: 'Test description',
    status: 'PUBLISHED',
  }

  it('renders course information', () => {
    render(<CourseCard course={mockCourse} />)

    expect(screen.getByText('Test Course')).toBeInTheDocument()
    expect(screen.getByText('Test description')).toBeInTheDocument()
  })

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    render(<CourseCard course={mockCourse} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('article'))

    expect(onSelect).toHaveBeenCalledWith('1')
  })

  it('shows progress when provided', () => {
    render(
      <CourseCard
        course={mockCourse}
        progress={{ completed: 5, total: 10 }}
      />
    )

    expect(screen.getByText('50%')).toBeInTheDocument()
  })
})
```

### API Tests

```tsx
// tests/api/courses.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import { GET, POST } from '@/app/api/courses/route'

describe('GET /api/courses', () => {
  it('returns paginated courses', async () => {
    const { req } = createMocks({
      method: 'GET',
      url: '/api/courses?page=1&limit=10',
    })

    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.items).toBeDefined()
    expect(data.data.total).toBeDefined()
  })
})

describe('POST /api/courses', () => {
  it('creates a course with valid data', async () => {
    const { req } = createMocks({
      method: 'POST',
      body: {
        title: 'New Course',
        description: 'Course description',
      },
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.success).toBe(true)
    expect(data.data.title).toBe('New Course')
  })

  it('returns 400 for invalid data', async () => {
    const { req } = createMocks({
      method: 'POST',
      body: {
        title: '', // Invalid: empty
      },
    })

    const response = await POST(req)

    expect(response.status).toBe(400)
  })
})
```

### Test Coverage

- **Unit tests:** Business logic, utilities, helpers
- **Component tests:** User interactions, state changes
- **Integration tests:** API routes, database operations
- **E2E tests:** Critical user flows (auth, checkout)

**Coverage targets:**
- Utilities: 90%+
- Components: 80%+
- API routes: 80%+
- Overall: 70%+

---

## Git Workflow

### Branch Naming

```
feature/  - New features
fix/      - Bug fixes
refactor/ - Code refactoring
docs/     - Documentation
chore/    - Maintenance tasks

Examples:
feature/course-progress-tracking
fix/enrollment-duplicate-error
refactor/auth-middleware
docs/api-documentation
chore/upgrade-dependencies
```

### Commit Messages

```
Format: <type>(<scope>): <description>

Types:
- feat: New feature
- fix: Bug fix
- refactor: Code change that neither fixes a bug nor adds a feature
- docs: Documentation only changes
- style: Formatting, missing semicolons, etc.
- test: Adding or updating tests
- chore: Maintenance tasks

Examples:
feat(courses): add progress tracking
fix(auth): resolve session expiry redirect loop
refactor(api): extract validation to middleware
docs(readme): update installation instructions
test(enrollment): add edge case tests
chore(deps): upgrade Next.js to 14.2
```

### Pull Request Standards

**Title:** Same format as commit messages

**Description template:**
```markdown
## Summary
Brief description of changes

## Changes
- Change 1
- Change 2

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Works on mobile

## Screenshots (if UI changes)
[Before/After screenshots]

## Related Issues
Closes #123
```

**Requirements:**
- All tests pass
- No TypeScript errors
- Lint passes
- At least 1 approval
- Up-to-date with main

---

## Naming Conventions

### Files & Folders

```
# Components: kebab-case
course-card.tsx
user-sidebar.tsx
empty-state.tsx

# Hooks: use-prefix, kebab-case
use-courses.ts
use-auth.ts
use-local-storage.ts

# Utils/Services: kebab-case
course-service.ts
format-date.ts
api-helpers.ts

# Types: kebab-case
course.types.ts
api.types.ts

# Constants: kebab-case
navigation.ts
routes.ts
```

### Variables & Functions

```tsx
// Variables: camelCase
const userName = 'John'
const isLoading = true
const courseList = []

// Functions: camelCase, verb prefix
function getUserById(id: string) {}
function calculateProgress(completed: number, total: number) {}
function handleSubmit(data: FormData) {}

// Boolean variables: is/has/can/should prefix
const isActive = true
const hasPermission = false
const canEdit = true
const shouldRefresh = false

// Event handlers: handle prefix
const handleClick = () => {}
const handleSubmit = () => {}
const handleChange = () => {}

// Async functions: verb implies async
async function fetchUsers() {}
async function createCourse(data: CreateCourseInput) {}
async function updateEnrollment(id: string, data: UpdateInput) {}
```

### Types & Interfaces

```tsx
// Types: PascalCase
type UserRole = 'ADMIN' | 'MEMBER'
type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

// Interfaces: PascalCase
interface User {
  id: string
  email: string
}

// Props: ComponentNameProps
interface CourseCardProps {
  course: Course
  onSelect?: (id: string) => void
}

// Input types: ActionEntityInput
type CreateCourseInput = { ... }
type UpdateUserInput = { ... }

// Response types: EntityResponse
type CourseResponse = { ... }
type PaginatedResponse<T> = { ... }
```

### Constants

```tsx
// SCREAMING_SNAKE_CASE for true constants
const MAX_FILE_SIZE = 5 * 1024 * 1024
const DEFAULT_PAGE_SIZE = 20
const API_TIMEOUT_MS = 30000

// Object constants: PascalCase
const Routes = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  COURSES: '/courses',
} as const

const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
} as const
```

---

## File & Folder Structure

```
legacyscale-saas/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group (no layout)
│   │   ├── login/
│   │   ├── signup/
│   │   └── forgot-password/
│   ├── (admin)/                  # Admin route group
│   │   └── admin/
│   │       ├── layout.tsx        # Admin layout with sidebar
│   │       ├── page.tsx          # Admin dashboard
│   │       ├── courses/
│   │       ├── members/
│   │       └── settings/
│   ├── (user)/                   # User route group
│   │   ├── layout.tsx            # User layout with sidebar
│   │   ├── dashboard/
│   │   ├── courses/
│   │   └── profile/
│   ├── api/                      # API routes
│   │   ├── auth/
│   │   ├── courses/
│   │   │   ├── route.ts          # GET, POST /api/courses
│   │   │   └── [id]/
│   │   │       └── route.ts      # GET, PATCH, DELETE /api/courses/:id
│   │   └── webhooks/
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Landing page
│   ├── loading.tsx               # Root loading
│   ├── error.tsx                 # Root error
│   └── not-found.tsx             # 404 page
│
├── components/
│   ├── ui/                       # ShadCN primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── input.tsx
│   ├── layout/                   # Layout components
│   │   ├── admin-sidebar.tsx
│   │   ├── user-sidebar.tsx
│   │   └── top-nav.tsx
│   ├── shared/                   # Shared components
│   │   ├── empty-state.tsx
│   │   ├── page-header.tsx
│   │   └── loading-skeleton.tsx
│   ├── courses/                  # Feature components
│   │   ├── course-card.tsx
│   │   ├── course-list.tsx
│   │   └── lesson-player.tsx
│   └── forms/                    # Form components
│       ├── course-form.tsx
│       └── user-form.tsx
│
├── lib/
│   ├── api/                      # API utilities
│   │   ├── helpers.ts
│   │   └── client.ts
│   ├── auth/                     # Auth utilities
│   │   ├── actions.ts
│   │   ├── get-user.ts
│   │   └── hooks.ts
│   ├── services/                 # Business logic
│   │   ├── course-service.ts
│   │   ├── user-service.ts
│   │   └── email-service.ts
│   ├── validations/              # Zod schemas
│   │   ├── auth.ts
│   │   ├── course.ts
│   │   └── common.ts
│   ├── supabase/                 # Supabase clients
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── prisma.ts                 # Prisma client
│   ├── utils.ts                  # General utilities
│   └── errors.ts                 # Error classes
│
├── hooks/                        # Custom React hooks
│   ├── use-courses.ts
│   ├── use-auth.ts
│   └── use-debounce.ts
│
├── types/                        # TypeScript types
│   ├── index.ts                  # Re-exports
│   ├── api.ts                    # API types
│   └── database.ts               # Database types
│
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── seed.ts                   # Seed script
│
├── emails/                       # React email templates
│   ├── welcome.tsx
│   └── password-reset.tsx
│
├── tests/                        # Test files
│   ├── lib/
│   ├── components/
│   └── api/
│
├── public/                       # Static assets
│   ├── images/
│   └── fonts/
│
├── middleware.ts                 # Next.js middleware
├── tailwind.config.ts
├── next.config.js
├── tsconfig.json
├── .env.local                    # Local env (not committed)
├── .env.example                  # Env template
└── package.json
```

---

## Quick Reference

### Before Committing Checklist

- [ ] Code follows style guide
- [ ] No TypeScript errors (`pnpm type-check`)
- [ ] Lint passes (`pnpm lint`)
- [ ] Tests pass (`pnpm test`)
- [ ] No console.log statements
- [ ] No hardcoded values (use constants/env)
- [ ] Loading states handled
- [ ] Error states handled
- [ ] Mobile responsive
- [ ] Accessible (keyboard nav, screen reader)

### Code Review Checklist

- [ ] Follows single responsibility principle
- [ ] Functions are under 30 lines
- [ ] Files are under 300 lines
- [ ] No code duplication
- [ ] Proper error handling
- [ ] Types are correct and specific
- [ ] No any types
- [ ] Security considerations addressed
- [ ] Performance considered
- [ ] Tests cover edge cases

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [ShadCN/UI Components](https://ui.shadcn.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Zod Documentation](https://zod.dev)
- [TanStack Query](https://tanstack.com/query)

---

*Last updated: Phase 0 - Foundation Setup*
