'use client'

// Global admin view for /admin/student-tasks. URL-driven filters so a
// deep link (from the dashboard "N overdue" widget or a per-student
// page) lands with the correct slice pre-applied. Read-only table —
// admins don't edit student tasks, they nudge instead (Phase D).

import { useMemo, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle2, ClipboardList, User } from 'lucide-react'

import { AvatarGroup } from '@/components/shared/avatar-group'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type {
  AdminStudentTaskItem,
  AdminStudentTaskListResult,
} from '@/lib/services/admin-student-task-service'

interface Props {
  result: AdminStudentTaskListResult
  students: Array<{ id: string; name: string | null; email: string }>
  filters: {
    studentId: string | null
    overdueOnly: boolean
    includeCompleted: boolean
  }
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export function StudentTasksShell({ result, students, filters }: Props) {
  const router = useRouter()
  const pathname = usePathname() ?? '/admin/student-tasks'
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function setParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams?.toString() ?? '')
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    // Any filter change should drop the page back to 1.
    if (!('page' in patch)) next.delete('page')
    const qs = next.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    })
  }

  const overdueCount = useMemo(
    () => result.items.filter((t) => t.isOverdue).length,
    [result.items],
  )

  return (
    <div className="space-y-6">
      {/* Subhead — the page-level H1 lives in the /admin/progress
          layout (PageHeader: "Progress Tracker"). This is just the
          Tasks-tab-specific context + counts. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Every personal task or goal students have set for themselves,
          with due dates and overdue status. Read-only — follow up
          with a nudge.
        </p>
        <div className="rounded-lg border bg-card px-3 py-2 text-xs">
          <span className="font-medium tabular-nums">{result.total}</span>{' '}
          <span className="text-muted-foreground">total</span>
          <span className="mx-2 text-muted-foreground/40">·</span>
          <span className="font-medium tabular-nums text-destructive">
            {overdueCount}
          </span>{' '}
          <span className="text-muted-foreground">overdue on page</span>
        </div>
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={filters.studentId ?? ''}
          onChange={(e) => setParams({ studentId: e.target.value || null })}
          disabled={pending}
        >
          <option value="">All students ({students.length})</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name?.trim() || s.email.split('@')[0]}
            </option>
          ))}
        </select>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={filters.overdueOnly}
            onCheckedChange={(c) =>
              setParams({ overdue: c ? '1' : null })
            }
            disabled={pending}
          />
          Overdue only
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={filters.includeCompleted}
            onCheckedChange={(c) =>
              setParams({ completed: c ? '1' : null })
            }
            disabled={pending}
          />
          Show completed
        </label>

        {(filters.studentId ||
          filters.overdueOnly ||
          filters.includeCompleted) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setParams({
                studentId: null,
                overdue: null,
                completed: null,
              })
            }
            disabled={pending}
          >
            Clear
          </Button>
        )}
      </Card>

      {/* Table */}
      {result.items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No student tasks match these filters"
          description={
            filters.studentId || filters.overdueOnly
              ? 'Try widening the filter, or clear it to see everything.'
              : 'Students haven’t created any personal tasks yet.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Task</TableHead>
                <TableHead className="whitespace-nowrap">Due</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((t) => (
                <StudentTaskRow key={t.id} task={t} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {result.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {result.page} of {result.totalPages} · {result.total}{' '}
            tasks
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={result.page <= 1 || pending}
              onClick={() =>
                setParams({ page: String(result.page - 1) })
              }
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!result.hasMore || pending}
              onClick={() =>
                setParams({ page: String(result.page + 1) })
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function StudentTaskRow({ task }: { task: AdminStudentTaskItem }) {
  const done = task.completedAt !== null
  return (
    <TableRow className="align-top">
      <TableCell>
        <div className="flex items-center gap-2">
          <AvatarGroup
            users={[
              {
                name: task.student.name ?? task.student.email,
                avatarUrl: task.student.avatarUrl,
              },
            ]}
            size="sm"
            max={1}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {task.student.name?.trim() ||
                task.student.email.split('@')[0]}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {task.student.email}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <p
          className={cn(
            'text-sm font-medium leading-snug',
            done && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </p>
        {task.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {task.description}
          </p>
        ) : null}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {task.dueDate ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs tabular-nums',
              task.isOverdue
                ? 'font-medium text-destructive'
                : 'text-muted-foreground',
            )}
          >
            {task.isOverdue ? (
              <AlertCircle className="size-3" />
            ) : null}
            {DATE_FMT.format(task.dueDate)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/60">
            No due date
          </span>
        )}
      </TableCell>
      <TableCell>
        {task.linkedCourse ? (
          <Link
            href={`/admin/courses/${task.linkedCourse.slug}`}
            className="line-clamp-2 text-xs text-primary hover:underline"
          >
            {task.linkedCourse.title}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground/60">—</span>
        )}
      </TableCell>
      <TableCell>
        {done ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-3" />
            Done
          </span>
        ) : task.isOverdue ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">
            <AlertCircle className="size-3" />
            Overdue
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <User className="size-3" />
            Open
          </span>
        )}
      </TableCell>
    </TableRow>
  )
}
