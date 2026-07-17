// Named saved views for the task tracker. Per-user (no sharing
// yet) — my "Overdue on me" shouldn't pollute someone else's
// dropdown — and tenant-scoped so views don't leak across
// companies for admins who span multiple tenants.
//
// Storage is intentionally tiny: (name, query). The query is the
// raw URL search string as saved. The shell splats it into the
// URL on load and re-parses via the same taskFilterSchema path
// the URL-driven filter bar uses — no separate "hydration" schema
// to keep in sync as filters evolve.

import { prisma } from '@/lib/prisma'

export class SavedViewNotFoundError extends Error {
  constructor(message = 'Saved view not found') {
    super(message)
    this.name = 'SavedViewNotFoundError'
  }
}

export class DuplicateSavedViewError extends Error {
  constructor(message = 'A saved view with that name already exists') {
    super(message)
    this.name = 'DuplicateSavedViewError'
  }
}

export interface SavedViewRow {
  id: string
  name: string
  query: string
  createdAt: Date
  updatedAt: Date
}

class TaskSavedViewService {
  async listMine(userId: string): Promise<SavedViewRow[]> {
    const rows = await prisma.taskSavedView.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        query: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return rows
  }

  /**
   * Create a view for the caller. The unique index on
   * (userId, companyId, name) protects against dupes, but we surface
   * the Prisma P2002 as a friendly DuplicateSavedViewError.
   */
  async create(args: {
    userId: string
    name: string
    query: string
  }): Promise<SavedViewRow> {
    try {
      const row = await prisma.taskSavedView.create({
        data: {
          userId: args.userId,
          name: args.name.trim(),
          // Strip a leading "?" if the caller passed a full search
          // string — normalize to the raw query body.
          query: args.query.replace(/^\?/, ''),
        },
        select: {
          id: true,
          name: true,
          query: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      return row
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (/Unique constraint/.test(message)) {
        throw new DuplicateSavedViewError()
      }
      throw err
    }
  }

  /** Rename in place. Same P2002 branching as create() so the caller
   *  gets a friendly error when the new name collides. */
  async rename(args: {
    id: string
    userId: string
    name: string
  }): Promise<SavedViewRow> {
    // Ownership + tenant scoping check: the tenancy extension only
    // scopes top-level ops, so we filter by userId too. If the row
    // isn't visible under both filters, treat as not-found.
    const existing = await prisma.taskSavedView.findFirst({
      where: { id: args.id, userId: args.userId },
      select: { id: true },
    })
    if (!existing) throw new SavedViewNotFoundError()
    try {
      return prisma.taskSavedView.update({
        where: { id: args.id },
        data: { name: args.name.trim() },
        select: {
          id: true,
          name: true,
          query: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (/Unique constraint/.test(message)) {
        throw new DuplicateSavedViewError()
      }
      throw err
    }
  }

  async delete(args: { id: string; userId: string }): Promise<void> {
    const existing = await prisma.taskSavedView.findFirst({
      where: { id: args.id, userId: args.userId },
      select: { id: true },
    })
    if (!existing) throw new SavedViewNotFoundError()
    await prisma.taskSavedView.delete({ where: { id: args.id } })
  }
}

export const taskSavedViewService = new TaskSavedViewService()
