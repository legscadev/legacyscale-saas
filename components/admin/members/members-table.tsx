'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SectionCard, StatusBadge } from '@/components/shared'
import { MemberActionsMenu } from './member-actions-menu'
import { MemberDrawer } from './member-drawer'
import { BulkActionBar } from './bulk-action-bar'
import type {
  MemberListItem,
  MemberSortField,
} from '@/lib/services/member-service'

interface MembersTableProps {
  members: MemberListItem[]
  currentUserId: string
}

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

export function MembersTable({ members, currentUserId }: MembersTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [drawerMemberId, setDrawerMemberId] = useState<string | null>(null)

  const drawerMember = useMemo(
    () => members.find((m) => m.id === drawerMemberId) ?? null,
    [drawerMemberId, members],
  )

  const allSelected = members.length > 0 && selected.size === members.length
  const someSelected = selected.size > 0 && !allSelected

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(members.map((m) => m.id)) : new Set())
  }

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const clearSelection = () => setSelected(new Set())

  return (
    <>
      <SectionCard flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={(c) => toggleAll(Boolean(c))}
                  aria-label="Select all on this page"
                />
              </TableHead>
              <SortableHead field="name">Member</SortableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <SortableHead field="createdAt">Joined</SortableHead>
              <SortableHead field="lastLoginAt">Last active</SortableHead>
              <TableHead className="w-12 text-right pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const isSelected = selected.has(m.id)
              return (
                <TableRow
                  key={m.id}
                  data-state={isSelected ? 'selected' : undefined}
                  onClick={() => setDrawerMemberId(m.id)}
                  className="cursor-pointer"
                >
                  <TableCell
                    className="pl-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(c) => toggleOne(m.id, Boolean(c))}
                      aria-label={`Select ${m.name ?? m.email}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        {m.avatarUrl ? (
                          <AvatarImage src={m.avatarUrl} alt="" />
                        ) : null}
                        <AvatarFallback>
                          {getInitials(m.name, m.email)}
                        </AvatarFallback>
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
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={m.role} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={
                        m.deletedAt
                          ? 'ARCHIVED'
                          : m.isActive
                            ? 'ACTIVE'
                            : 'PAUSED'
                      }
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(m.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRelative(m.lastLoginAt)}
                  </TableCell>
                  <TableCell
                    className="pr-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MemberActionsMenu
                      memberId={m.id}
                      isActive={m.isActive}
                      isSelf={m.id === currentUserId}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </SectionCard>

      <MemberDrawer
        member={drawerMember}
        open={drawerMemberId !== null}
        onOpenChange={(open) => {
          if (!open) setDrawerMemberId(null)
        }}
      />

      <BulkActionBar
        selectedCount={selected.size}
        onClear={clearSelection}
      />
    </>
  )
}

function SortableHead({
  field,
  children,
}: {
  field: MemberSortField
  children: React.ReactNode
}) {
  const params = useSearchParams()
  const currentSort = params.get('sort') ?? 'createdAt'
  const currentDir = params.get('direction') ?? 'desc'
  const active = currentSort === field

  const nextDir = active && currentDir === 'desc' ? 'asc' : 'desc'

  const next = new URLSearchParams(params)
  next.set('sort', field)
  next.set('direction', nextDir)
  next.delete('page')

  return (
    <TableHead>
      <Link
        href={`?${next.toString()}`}
        replace
        scroll={false}
        className={cn(
          'group inline-flex items-center gap-1.5 transition-colors',
          active ? 'text-foreground' : 'hover:text-foreground',
        )}
      >
        {children}
        {active ? (
          currentDir === 'desc' ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronUp className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="size-3.5 opacity-50 group-hover:opacity-100" />
        )}
      </Link>
    </TableHead>
  )
}
