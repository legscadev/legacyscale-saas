'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { StatusBadge } from '@/components/shared'
import { MemberActionsMenu } from './member-actions-menu'
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

export function getMemberColumns(
  currentUserId: string,
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
      size: 40,
      meta: { className: 'pl-4 w-10', stopRowClick: true },
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <SortHeader column={column}>Member</SortHeader>,
      cell: ({ row }) => {
        const m = row.original
        return (
          <div className="flex items-center gap-3">
            <Avatar size="sm">
              {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
              <AvatarFallback>{getInitials(m.name, m.email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {m.name ?? m.email.split('@')[0]}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {m.email}
              </p>
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
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
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
      accessorKey: 'createdAt',
      header: ({ column }) => <SortHeader column={column}>Joined</SortHeader>,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      accessorKey: 'lastLoginAt',
      header: ({ column }) => (
        <SortHeader column={column}>Last active</SortHeader>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatRelative(row.original.lastLoginAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <MemberActionsMenu
            memberId={row.original.id}
            isActive={row.original.isActive}
            isSelf={row.original.id === currentUserId}
          />
        </div>
      ),
      enableSorting: false,
      size: 56,
      meta: { className: 'pr-4 w-14', stopRowClick: true },
    },
  ]
}
