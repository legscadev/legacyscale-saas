'use client'

import type { Column, ColumnDef } from '@tanstack/react-table'
import { formatDistanceToNow } from 'date-fns'
import {
  ArrowUpDown,
  Building2,
  ChevronDown,
  ChevronUp,
  Globe2,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { PLATFORM_SEED_COMPANY_ID } from '@/lib/tenancy/seed'

import type { CompanyDirectoryRow } from '@/app/(super)/super/companies/types'

import { CompanyRowActions } from './company-row-actions'

function SortHeader({
  column,
  children,
  align,
}: {
  column: Column<CompanyDirectoryRow, unknown>
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  const sorted = column.getIsSorted()
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === 'asc')}
      className={cn(
        'inline-flex items-center gap-1.5 transition-colors',
        align === 'right' && 'flex-row-reverse',
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

export const companyColumns: ColumnDef<CompanyDirectoryRow, unknown>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => <SortHeader column={column}>Name</SortHeader>,
    cell: ({ row }) => {
      const c = row.original
      return (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-500/10 text-brand-600">
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0">
            <span className="truncate font-medium">{c.name}</span>
            <div className="truncate text-xs text-muted-foreground">
              {c.slug}
            </div>
          </div>
        </div>
      )
    },
  },
  {
    id: 'owner',
    accessorKey: 'ownerName',
    header: 'Owner',
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.ownerName ?? '—'}
      </span>
    ),
  },
  {
    id: 'members',
    accessorKey: 'memberCount',
    header: ({ column }) => (
      <SortHeader column={column} align="right">
        Members
      </SortHeader>
    ),
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{row.original.memberCount}</div>
    ),
    meta: { className: 'text-right' },
  },
  {
    id: 'domain',
    accessorKey: 'customDomain',
    header: 'Custom domain',
    cell: ({ row }) => {
      const d = row.original.customDomain
      if (!d) return <span className="text-muted-foreground">—</span>
      return (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Globe2 className="size-3.5" />
          {d}
        </span>
      )
    },
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: ({ column }) => <SortHeader column={column}>Created</SortHeader>,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDistanceToNow(row.original.createdAt, { addSuffix: true })}
      </span>
    ),
  },
  {
    id: 'action',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="text-right">
        <CompanyRowActions
          companyId={row.original.id}
          companyName={row.original.name}
          isProtected={row.original.id === PLATFORM_SEED_COMPANY_ID}
        />
      </div>
    ),
    meta: { className: 'text-right', stopRowClick: true },
    enableSorting: false,
  },
]
