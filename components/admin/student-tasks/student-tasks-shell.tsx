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
import { NudgeRowAction } from '@/components/admin/progress/nudge-row-action'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { nudgeTemplateForTask } from './nudge-template'
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

  const anyFilterActive =
    !!filters.studentId ||
    filters.overdueOnly ||
    filters.includeCompleted

  return (
    <div className="space-y-4">
      {/* One-line toolbar — description on the left, filters + counts
          on the right. No wrapper card; the toolbar sits directly on
          the page for a lighter feel. Wraps naturally on narrow
          viewports. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="mr-auto text-sm text-muted-foreground">
          Personal tasks + goals students set for themselves.{' '}
          <span className="text-muted-foreground/60">
            Read-only — follow up with a nudge.
          </span>
        </p>

        {/* Count chip — inline, muted, right-aligned with the filters
            so the eye reads: description ← → count · filters. */}
        <div className="text-xs text-muted-foreground tabular-nums">
          <span className="font-medium text-foreground">{result.total}</span>{' '}
          total
          {overdueCount > 0 ? (
            <>
              {' · '}
              <span className="font-medium text-destructive">
                {overdueCount}
              </span>{' '}
              overdue
            </>
          ) : null}
        </div>

        <select
          className="h-8 rounded-md border border-input bg-transparent px-2.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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

        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
          <Checkbox
            checked={filters.overdueOnly}
            onCheckedChange={(c) =>
              setParams({ overdue: c ? '1' : null })
            }
            disabled={pending}
          />
          Overdue
        </label>

        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
          <Checkbox
            checked={filters.includeCompleted}
            onCheckedChange={(c) =>
              setParams({ completed: c ? '1' : null })
            }
            disabled={pending}
          />
          Show completed
        </label>

        {anyFilterActive ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
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
        ) : null}
      </div>

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
                <TableHead className="w-12 text-right">Actions</TableHead>
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
  // Tighter row: py-2 (vs py-4 default). Single-line student cell —
  // name only, email in the tooltip via title.
  return (
    <TableRow className="align-middle [&>td]:py-2">
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
          <span
            className="truncate text-sm font-medium"
            title={task.student.email}
          >
            {task.student.name?.trim() ||
              task.student.email.split('@')[0]}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <p
          className={cn(
            'truncate text-sm font-medium leading-snug',
            done && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </p>
        {task.description ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
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
      <TableCell className="text-right">
        {done ? null : (
          <NudgeRowAction
            memberId={task.student.id}
            memberName={task.student.name ?? task.student.email}
            messageTemplate={nudgeTemplateForTask(task)}
          />
        )}
      </TableCell>
    </TableRow>
  )
}
