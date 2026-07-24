'use client'

import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, ChevronDown, ChevronUp, ImageIcon } from 'lucide-react'

import { cn, htmlToPlainText } from '@/lib/utils'
import { StatusBadge } from '@/components/shared'
import { CourseActionsMenu } from './course-actions-menu'
import type { CourseListItem } from '@/lib/services/course-service'

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function SortHeader({
  column,
  children,
}: {
  column: import('@tanstack/react-table').Column<CourseListItem, unknown>
  children: React.ReactNode
}) {
  const sorted = column.getIsSorted()
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === 'asc')}
      className={cn(
        'inline-flex items-center gap-1.5 transition-colors',
        sorted ? 'text-foreground' : 'hover:text-foreground',
      )}
    >
      {children}
      {sorted === 'desc' ? (
        <ChevronDown className="size-3.5" />
      ) : sorted === 'asc' ? (
        <ChevronUp className="size-3.5" />
      ) : (
        <ArrowUpDown className="size-3.5 opacity-50" />
      )}
    </button>
  )
}

export function getCourseColumns(
  onRefetch: () => void,
): ColumnDef<CourseListItem>[] {
  return [
    {
      accessorKey: 'title',
      header: ({ column }) => <SortHeader column={column}>Course</SortHeader>,
      cell: ({ row }) => {
        const c = row.original
        return (
          <div className="flex items-center gap-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
              {c.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.thumbnailUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-muted-foreground">
                  <ImageIcon className="size-5" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/admin/courses/${c.slug}`}
                  className="truncate text-sm font-medium transition-colors hover:text-primary hover:underline underline-offset-2"
                >
                  {c.title}
                </Link>
                {c.audience === 'INTERNAL' ? (
                  <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Internal
                  </span>
                ) : c.audience === 'BOTH' ? (
                  <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sky-700 dark:text-sky-400">
                    Internal + Members
                  </span>
                ) : c.isFree ? (
                  <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Free
                  </span>
                ) : null}
              </div>
              {c.description ? (
                <p className="max-w-md truncate text-xs text-muted-foreground">
                  {htmlToPlainText(c.description)}
                </p>
              ) : null}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      enableSorting: false,
    },
    {
      id: 'chapters',
      header: 'Chapters',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {row.original.chaptersCount.toLocaleString()}
        </span>
      ),
      enableSorting: false,
    },
    {
      id: 'lessons',
      header: 'Lessons',
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {row.original.lessonsCount.toLocaleString()}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <SortHeader column={column}>Created</SortHeader>
      ),
      cell: ({ row }) => (
        <span
          className="text-sm text-muted-foreground"
          suppressHydrationWarning
        >
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <CourseActionsMenu
            courseId={row.original.id}
            courseSlug={row.original.slug}
            courseTitle={row.original.title}
            status={row.original.status}
            isDeleted={!!row.original.deletedAt}
            onRefetch={onRefetch}
          />
        </div>
      ),
      enableSorting: false,
      size: 56,
      meta: { className: 'pr-4 w-14', stopRowClick: true },
    },
  ]
}
