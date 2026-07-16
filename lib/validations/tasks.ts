// Zod schemas for the Internal Task Tracker.
//
// Split by concern so form components can import just the shape they
// need without dragging in unrelated field rules. Priority is a fixed
// enum (matches the Prisma one); statuses / labels / categories are
// user-managed rows referenced by id.
//
// Date fields accept an ISO string or an empty string (which becomes
// null). The transform runs on input so services always see Date | null.

import { z } from 'zod'

// ============================================
// SHARED PRIMITIVES
// ============================================

export const taskPrioritySchema = z.enum([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
])
export type TaskPriorityValue = z.infer<typeof taskPrioritySchema>

export const TASK_PRIORITY_LABELS: Record<TaskPriorityValue, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
}

/** Priority ordered high→low for sorting; lower index = higher priority. */
export const TASK_PRIORITY_ORDER: Record<TaskPriorityValue, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

/**
 * ISO date string / empty → Date | null. Kept local to the tasks
 * module (not shared) because tasks accept both plain YYYY-MM-DD and
 * full ISO timestamps.
 */
const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v ? v : null))
  .refine(
    (v) => v === null || !Number.isNaN(new Date(v).getTime()),
    { message: 'Invalid date' },
  )
  .transform((v) => (v === null ? null : new Date(v)))
  .nullable()

// ============================================
// TASK CRUD
// ============================================

/**
 * Create-task payload. `statusId` is optional — the service falls
 * back to the tenant's default status when omitted so quick-add
 * forms only need a title.
 */
export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().max(20000).nullable().optional(),
  statusId: z.string().uuid().optional(),
  priority: taskPrioritySchema.optional().default('MEDIUM'),
  categoryId: z.string().uuid().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  startDate: optionalDate.optional(),
  dueDate: optionalDate.optional(),
  estimatedHours: z.number().min(0).max(10000).nullable().optional(),
  assigneeIds: z.array(z.string().uuid()).max(50).optional().default([]),
  watcherIds: z.array(z.string().uuid()).max(100).optional().default([]),
  labelIds: z.array(z.string().uuid()).max(50).optional().default([]),
})
export type CreateTaskInput = z.input<typeof createTaskSchema>

/**
 * Partial update. Every field optional; explicit null clears the value
 * (dates, category, description). Assignees / watchers / labels
 * replace the full set when provided.
 */
export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(20000).nullable().optional(),
  statusId: z.string().uuid().optional(),
  priority: taskPrioritySchema.optional(),
  categoryId: z.string().uuid().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  startDate: optionalDate.optional(),
  dueDate: optionalDate.optional(),
  estimatedHours: z.number().min(0).max(10000).nullable().optional(),
  actualHours: z.number().min(0).max(10000).nullable().optional(),
  orderIndex: z.number().int().optional(),
  assigneeIds: z.array(z.string().uuid()).max(50).optional(),
  watcherIds: z.array(z.string().uuid()).max(100).optional(),
  labelIds: z.array(z.string().uuid()).max(50).optional(),
})
export type UpdateTaskInput = z.input<typeof updateTaskSchema>

// ============================================
// FILTER / QUERY
// ============================================

/**
 * List-view filters. Every field optional; arrays are OR'd within a
 * facet, AND'd across facets. `search` matches title + description
 * ILIKE %q%. `includeArchived` off by default — archived rows are
 * hidden unless the user opts in.
 */
export const taskFilterSchema = z.object({
  search: z.string().trim().max(200).optional(),
  statusIds: z.array(z.string().uuid()).optional(),
  priorities: z.array(taskPrioritySchema).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  labelIds: z.array(z.string().uuid()).optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  reporterIds: z.array(z.string().uuid()).optional(),
  dueBefore: optionalDate.optional(),
  dueAfter: optionalDate.optional(),
  includeArchived: z.boolean().optional().default(false),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'dueDate', 'priority', 'orderIndex'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})
export type TaskFilterInput = z.input<typeof taskFilterSchema>
/**
 * Post-parse shape passed to the service — defaults filled in, dates
 * coerced. Actions parse with the schema then hand this shape down.
 */
export type TaskFilterOutput = z.output<typeof taskFilterSchema>

// ============================================
// COMMENTS
// ============================================

export const addCommentSchema = z.object({
  taskId: z.string().uuid(),
  body: z.string().trim().min(1, 'Comment cannot be empty').max(20000),
  mentions: z.array(z.string().uuid()).max(50).optional().default([]),
})
export type AddCommentInput = z.input<typeof addCommentSchema>

export const editCommentSchema = z.object({
  commentId: z.string().uuid(),
  body: z.string().trim().min(1).max(20000),
  mentions: z.array(z.string().uuid()).max(50).optional().default([]),
})
export type EditCommentInput = z.input<typeof editCommentSchema>

// ============================================
// CHECKLISTS
// ============================================

export const createChecklistSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().trim().min(1, 'Title is required').max(120),
})
export type CreateChecklistInput = z.input<typeof createChecklistSchema>

export const renameChecklistSchema = z.object({
  checklistId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
})
export type RenameChecklistInput = z.input<typeof renameChecklistSchema>

export const addChecklistItemSchema = z.object({
  checklistId: z.string().uuid(),
  text: z.string().trim().min(1, 'Text is required').max(200),
})
export type AddChecklistItemInput = z.input<typeof addChecklistItemSchema>

export const updateChecklistItemSchema = z.object({
  itemId: z.string().uuid(),
  text: z.string().trim().min(1).max(200).optional(),
  isDone: z.boolean().optional(),
})
export type UpdateChecklistItemInput = z.input<typeof updateChecklistItemSchema>

export const reorderChecklistItemsSchema = z.object({
  checklistId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()).min(1).max(200),
})
export type ReorderChecklistItemsInput = z.input<
  typeof reorderChecklistItemsSchema
>

// ============================================
// ASSIGNMENT / WATCHERS
// ============================================

export const assignTaskSchema = z.object({
  taskId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).max(50),
})
export type AssignTaskInput = z.input<typeof assignTaskSchema>

export const watchTaskSchema = z.object({
  taskId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).max(100),
})
export type WatchTaskInput = z.input<typeof watchTaskSchema>

// ============================================
// STATUS TRANSITION
// ============================================

/** Dedicated schema for drag-drop status changes so the action can
 *  short-circuit without loading the full task edit form. */
export const changeStatusSchema = z.object({
  taskId: z.string().uuid(),
  statusId: z.string().uuid(),
  /** Position within the target column, 0-indexed. Optional; when
   *  omitted the task drops at the end. */
  orderIndex: z.number().int().min(0).optional(),
})
export type ChangeStatusInput = z.input<typeof changeStatusSchema>

// ============================================
// ATTACHMENTS
// ============================================

/**
 * Registered after the client uploads bytes to Supabase Storage. The
 * server verifies the storage path lives under the tenant's prefix
 * before writing the row.
 */
export const registerAttachmentSchema = z.object({
  taskId: z.string().uuid(),
  path: z.string().min(1).max(500),
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().max(100),
  size: z.number().int().min(0).max(50 * 1024 * 1024),
})
export type RegisterAttachmentInput = z.input<typeof registerAttachmentSchema>

// ============================================
// WORKFLOW ADMIN (statuses / labels / categories)
// ============================================

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export const upsertStatusSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase, letters/digits/hyphens'),
  color: z.string().regex(HEX_COLOR, 'Color must be #RRGGBB'),
  orderIndex: z.number().int().min(0).default(0),
  isDefault: z.boolean().default(false),
  isTerminal: z.boolean().default(false),
  wipLimit: z.number().int().min(0).max(500).nullable().optional(),
})
export type UpsertStatusInput = z.input<typeof upsertStatusSchema>

export const upsertLabelSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(HEX_COLOR, 'Color must be #RRGGBB'),
})
export type UpsertLabelInput = z.input<typeof upsertLabelSchema>

export const upsertCategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(HEX_COLOR, 'Color must be #RRGGBB'),
})
export type UpsertCategoryInput = z.input<typeof upsertCategorySchema>
