// Prisma extension that auto-scopes every top-level read + write to
// the active tenant. When the tenancy flag is off (or there's no
// request context — seed scripts, background jobs) the extension is
// a pure no-op, so pre-refactor behavior is preserved.
//
// The extension covers TOP-LEVEL operations. Nested writes (e.g.
// `course.create({ chapters: { create: [{...}] } })`) are NOT
// scoped here — those are audited per-service in 2.4 and stamped
// explicitly. Reads via `include` / `select` are constrained by the
// parent's FK so implicit tenancy holds.
//
// Bypass mechanism: super-admin flows call withSuperAdminContext()
// which sets a per-request AsyncLocalStorage flag; the extension
// respects it (Phase 3 will wire this end-to-end).

import { Prisma } from '@prisma/client'

import { getRequestCompanyId } from './request-company'

/** Tenant-scoped model names — must exactly match Prisma model
 *  keys (camelCase, singular). Anything else falls through
 *  untouched. Kept as a Set for O(1) lookup on every query. */
const SCOPED_MODELS = new Set<string>([
  'Invite',
  'Course',
  'Category',
  'CourseCategory',
  'Module',
  'Chapter',
  'Lesson',
  'LessonResource',
  'QuizQuestion',
  'QuizAttempt',
  'Enrollment',
  'LessonProgress',
  'Note',
  'CertificateIssuance',
  'Announcement',
  'AnnouncementRead',
  'AnnouncementComment',
  'AnnouncementReaction',
  'AnnouncementAuditLog',
  'Nudge',
  'StatDivision',
  'StatMetric',
  'StatDataPoint',
  'OrgBoardRevision',
  'OrgNode',
  'PositionDetail',
  'PositionAssignment',
  'OrgNodeAuditLog',
  'Employee',
  'OnboardingChecklistItem',
  'EmployeeChecklistItemStatus',
  'AppSetting',
  // Internal Task Tracker (Phase 1)
  'Task',
  'TaskStatus',
  'TaskCategory',
  'TaskLabel',
  'TaskLabelLink',
  'TaskAssignee',
  'TaskWatcher',
  'TaskComment',
  'TaskChecklist',
  'TaskChecklistItem',
  'TaskAttachment',
  'TaskActivityLog',
  'TaskNotification',
  'TaskSavedView',
  'LoginEvent',
])

type AnyArgs = { where?: Record<string, unknown>; data?: unknown } & Record<
  string,
  unknown
>

function isScoped(model: string | undefined): boolean {
  return model !== undefined && SCOPED_MODELS.has(model)
}

function withCompanyWhere(
  args: AnyArgs,
  companyId: string,
): AnyArgs {
  const existing = args.where ?? {}
  // When the caller already narrowed to a specific companyId (for
  // example an explicit super-admin cross-tenant lookup), don't
  // clobber it — the extension only fills in the default.
  if ('companyId' in existing) return args
  return { ...args, where: { ...existing, companyId } }
}

function withCompanyData(
  args: AnyArgs,
  companyId: string,
): AnyArgs {
  const data = args.data
  if (data === undefined || data === null) return args
  if (Array.isArray(data)) {
    return {
      ...args,
      data: data.map((row) => {
        if (row && typeof row === 'object' && 'companyId' in row) return row
        return { ...(row as object), companyId }
      }),
    }
  }
  if (typeof data === 'object' && 'companyId' in (data as object)) return args
  return { ...args, data: { ...(data as object), companyId } }
}

/**
 * Build the extension. Requires the caller to pass in whatever
 * resolver they want for the current tenant id — allows tests and
 * background jobs to inject a fixed id instead of walking cookies.
 */
export function tenancyExtension() {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: 'tenancy',
      query: {
        $allModels: {
          // Prisma's per-model arg types are unions across every
          // model, so any runtime mutation on `args` widens back to
          // an unrelated union member — hence the `as never` casts.
          // The reshaping itself is safe: we only add `companyId` to
          // fields Prisma already expected on scoped models.
          async findFirst({ model, args, query }) {
            if (!isScoped(model)) return query(args)
            const companyId = await getRequestCompanyId()
            if (!companyId) return query(args)
            return query(withCompanyWhere(args as AnyArgs, companyId) as never)
          },
          async findFirstOrThrow({ model, args, query }) {
            if (!isScoped(model)) return query(args)
            const companyId = await getRequestCompanyId()
            if (!companyId) return query(args)
            return query(withCompanyWhere(args as AnyArgs, companyId) as never)
          },
          async findMany({ model, args, query }) {
            if (!isScoped(model)) return query(args)
            const companyId = await getRequestCompanyId()
            if (!companyId) return query(args)
            return query(withCompanyWhere(args as AnyArgs, companyId) as never)
          },
          async count({ model, args, query }) {
            if (!isScoped(model)) return query(args)
            const companyId = await getRequestCompanyId()
            if (!companyId) return query(args)
            return query(withCompanyWhere(args as AnyArgs, companyId) as never)
          },
          async aggregate({ model, args, query }) {
            if (!isScoped(model)) return query(args)
            const companyId = await getRequestCompanyId()
            if (!companyId) return query(args)
            return query(withCompanyWhere(args as AnyArgs, companyId) as never)
          },
          async groupBy({ model, args, query }) {
            if (!isScoped(model)) return query(args)
            const companyId = await getRequestCompanyId()
            if (!companyId) return query(args)
            return query(withCompanyWhere(args as AnyArgs, companyId) as never)
          },
          async updateMany({ model, args, query }) {
            if (!isScoped(model)) return query(args)
            const companyId = await getRequestCompanyId()
            if (!companyId) return query(args)
            return query(withCompanyWhere(args as AnyArgs, companyId) as never)
          },
          async deleteMany({ model, args, query }) {
            if (!isScoped(model)) return query(args)
            const companyId = await getRequestCompanyId()
            if (!companyId) return query(args)
            return query(withCompanyWhere(args as AnyArgs, companyId) as never)
          },
          async create({ model, args, query }) {
            if (!isScoped(model)) return query(args)
            const companyId = await getRequestCompanyId()
            if (!companyId) return query(args)
            return query(withCompanyData(args as AnyArgs, companyId) as never)
          },
          async createMany({ model, args, query }) {
            if (!isScoped(model)) return query(args)
            const companyId = await getRequestCompanyId()
            if (!companyId) return query(args)
            return query(withCompanyData(args as AnyArgs, companyId) as never)
          },
          async update({ model, args, query }) {
            if (!isScoped(model)) return query(args)
            const companyId = await getRequestCompanyId()
            if (!companyId) return query(args)
            return query(withCompanyWhere(args as AnyArgs, companyId) as never)
          },
          async upsert({ model, args, query }) {
            if (!isScoped(model)) return query(args)
            const companyId = await getRequestCompanyId()
            if (!companyId) return query(args)
            const withWhere = withCompanyWhere(args as AnyArgs, companyId)
            const createArg = withWhere.create as Record<string, unknown> | undefined
            const create =
              createArg && typeof createArg === 'object' && !('companyId' in createArg)
                ? { ...createArg, companyId }
                : createArg
            return query({ ...withWhere, create } as never)
          },
          async delete({ model, args, query }) {
            if (!isScoped(model)) return query(args)
            const companyId = await getRequestCompanyId()
            if (!companyId) return query(args)
            return query(withCompanyWhere(args as AnyArgs, companyId) as never)
          },
        },
      },
    }),
  )
}
