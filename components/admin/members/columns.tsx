'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { AvatarLightbox, StatusBadge } from '@/components/shared'
import { MemberActionsMenu } from './member-actions-menu'
import type { MemberCategoryOption } from './members-shell'
import type { MemberListItem } from '@/lib/services/member-service'

function getInitials(name: string | null, email: string): string {
  const source = name?.trim() || email
  const parts = source.split(/\s+/)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function formatDate(date: Date | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date)
}

function formatRelative(date: Date | null): string {
  if (!date) return 'Never'
  const ms = Date.now() - date.getTime()
  const sec = Math.round(ms / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d ago`
  return formatDate(date)
}

function SortHeader({
  column,
  children,
}: {
  column: import('@tanstack/react-table').Column<MemberListItem, unknown>
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

function ActivitySparkline({ data }: { data: number[] }) {
  if (data.every((v) => v === 0)) {
    return <span className="text-xs text-muted-foreground">No activity</span>
  }
  return (
    <div className="h-6 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.map((v, i) => ({ v, i }))}>
          <Area
            type="monotone"
            dataKey="v"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary)/0.1)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function getMemberColumns(
  currentUserId: string,
  onRefetch: () => void,
  sparklines: Record<string, number[]> = {},
  categories: MemberCategoryOption[] = [],
): ColumnDef<MemberListItem>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(c) => table.toggleAllPageRowsSelected(Boolean(c))}
          aria-label="Select all on this page"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(c) => row.toggleSelected(Boolean(c))}
          aria-label={`Select ${row.original.name ?? row.original.email}`}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
      meta: { className: 'pl-4 w-10', stopRowClick: true },
    },
    {
      accessorKey: 'name',
      enableHiding: false,
      header: ({ column }) => <SortHeader column={column}>Member</SortHeader>,
      cell: ({ row }) => {
        const m = row.original
        return (
          <div className="flex items-center gap-3">
            <AvatarLightbox
              photoUrl={m.avatarUrl}
              label={`View ${m.name ?? m.email}'s photo`}
              alt={`${m.name ?? m.email}'s photo`}
            >
              <Avatar size="sm">
                {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
                <AvatarFallback>
                  {getInitials(m.name, m.email)}
                </AvatarFallback>
              </Avatar>
            </AvatarLightbox>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {m.name ?? m.email.split('@')[0]}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {m.email}
              </p>
              {(() => {
                const invite = m.invites?.[0]
                // Clear the badge for any member who's actually
                // signed in — the wizard's "Finish" click is the
                // only thing that stamps invite.usedAt, and users
                // who bounce before that step (or hit a network
                // flake on the /complete POST) leave usedAt null
                // forever. lastLoginAt is a truer "onboarded"
                // signal than usedAt is.
                if (!invite || invite.usedAt || m.lastLoginAt) return null
                const label = invite.passwordSetAt
                  ? 'Onboarding'
                  : new Date(invite.expiresAt) < new Date()
                    ? 'Invite expired'
                    : 'Invited'
                return (
                  <span className={cn(
                    'mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium leading-none',
                    label === 'Invite expired'
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-primary/10 text-primary',
                  )}>
                    {label}
                  </span>
                )
              })()}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => <StatusBadge status={row.original.role} />,
      enableSorting: false,
      meta: { label: 'Role' },
    },
    {
      id: 'category',
      accessorFn: (row) => row.category?.name ?? null,
      header: 'Category',
      meta: { label: 'Category' },
      cell: ({ row }) => {
        const cat = row.original.category
        if (!cat) {
          return (
            <span className="text-xs italic text-muted-foreground">
              None
            </span>
          )
        }
        return (
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
            {cat.name}
          </span>
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      meta: { label: 'Status' },
      cell: ({ row }) => {
        const m = row.original
        return (
          <StatusBadge
            status={m.deletedAt ? 'ARCHIVED' : m.isActive ? 'ACTIVE' : 'PAUSED'}
          />
        )
      },
      enableSorting: false,
    },
    {
      id: 'enrollments',
      accessorFn: (row) => row._count.enrollments,
      header: 'Enrollments',
      meta: { label: 'Enrollments' },
      cell: ({ getValue }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {getValue<number>()}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'createdAt',
      meta: { label: 'Joined' },
      header: ({ column }) => <SortHeader column={column}>Joined</SortHeader>,
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
      accessorKey: 'lastActiveAt',
      meta: { label: 'Last active' },
      header: ({ column }) => (
        <SortHeader column={column}>Last active</SortHeader>
      ),
      cell: ({ row }) => {
        // Prefer the continuous-activity ping; fall back to the
        // last explicit login for pre-feature rows that haven't
        // been pinged yet.
        const ts =
          row.original.lastActiveAt ?? row.original.lastLoginAt
        return (
          <span
            className="text-sm text-muted-foreground"
            suppressHydrationWarning
          >
            {formatRelative(ts)}
          </span>
        )
      },
    },
    {
      id: 'activity',
      header: 'Activity (30d)',
      meta: { label: 'Activity (30d)' },
      cell: ({ row }) => {
        const data = sparklines[row.original.id] ?? Array(30).fill(0)
        return <ActivitySparkline data={data} />
      },
      enableSorting: false,
    },
    {
      id: 'actions',
      enableHiding: false,
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <MemberActionsMenu
            memberId={row.original.id}
            memberName={row.original.name ?? row.original.email}
            memberEmail={row.original.email}
            memberRole={row.original.role}
            memberCategoryId={row.original.categoryId}
            categories={categories}
            isActive={row.original.isActive}
            isArchived={!!row.original.deletedAt}
            isSelf={row.original.id === currentUserId}
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
