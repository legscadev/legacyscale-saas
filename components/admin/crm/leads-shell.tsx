'use client'

// Client container for the Contacts list. Filters are URL-driven —
// the page is force-dynamic and re-fetches on searchParams change,
// so the shell just reads current params via useSearchParams and
// pushes new ones. Row mutations + dialog submits reconcile via
// router.refresh().
//
// Mirrors the GHL Contacts surface: toolbar with Filters button,
// Sort button, Search, per-page selector, and pagination.

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown, Filter, Plus, Search, Upload } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import type { LeadListItem } from '@/lib/services/crm-lead-service'

import type { LeadsWorkspacePayload } from '@/app/(admin)/admin/crm/leads/actions'

import { ConvertLeadDialog } from './convert-lead-dialog'
import {
  ContactsFilterDrawer,
  contactsFilterToParams,
  countActiveContactFilters,
  parseContactsFilterFromParams,
} from './contacts-filter-drawer'
import { CreateLeadDialog } from './create-lead-dialog'
import { ImportLeadsDialog } from './import-leads-dialog'
import { LeadsTable } from './leads-table'

type SortField =
  | 'createdAt'
  | 'lastActivityAt'
  | 'fullName'
  | 'status'
  | 'email'
  | 'phone'
  | 'companyName'

const SORT_LABELS: Record<SortField, string> = {
  createdAt: 'Date created',
  lastActivityAt: 'Last activity',
  fullName: 'Contact name',
  status: 'Status',
  email: 'Email',
  phone: 'Phone',
  companyName: 'Company',
}

const PER_PAGE_CHOICES = [20, 50, 100, 200]

interface LeadsShellProps {
  initialData: LeadsWorkspacePayload
  basePath: string
  /** Team surface pins the "mine" filter on and hides the toggle. */
  teamSurface?: boolean
}

export function LeadsShell({
  initialData,
  basePath,
  teamSurface,
}: LeadsShellProps) {
  const router = useRouter()
  const params = useSearchParams()
  const { leads, members } = initialData

  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [convertLead, setConvertLead] = useState<LeadListItem | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState(params.get('q') ?? '')

  const mine = params.get('mine') === '1'
  const sortBy = (params.get('sort') as SortField) ?? 'createdAt'
  const sortOrder = params.get('dir') === 'asc' ? 'asc' : 'desc'
  const perPage = Number(params.get('per_page') ?? '') || leads.limit

  const filterState = useMemo(
    () => parseContactsFilterFromParams(params),
    [params],
  )
  const activeFilterCount = countActiveContactFilters(filterState)

  /** Push a new query string, resetting page unless paging. */
  function setParams(
    next: Record<string, string | null>,
    keepPage = false,
  ) {
    const qs = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') qs.delete(k)
      else qs.set(k, v)
    }
    if (!keepPage) qs.delete('page')
    const s = qs.toString()
    router.push(s ? `${basePath}?${s}` : basePath)
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setParams({ q: searchDraft.trim() || null })
  }

  function handleSort(field: SortField) {
    const nextDir = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc'
    setParams({ sort: field, dir: nextDir }, true)
  }

  const page = leads.page

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contacts"
        description={`${leads.total} contact${leads.total === 1 ? '' : 's'}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="size-4" />
              Import
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New contact
            </Button>
          </div>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilterOpen(true)}
          className="gap-1.5"
        >
          <Filter className="size-3.5" />
          Filters
          {activeFilterCount > 0 ? (
            <span className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowUpDown className="size-3.5" />
                Sort
                <span className="text-xs text-muted-foreground">
                  · {SORT_LABELS[sortBy]}
                  {sortOrder === 'asc' ? ' ↑' : ' ↓'}
                </span>
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-48">
            {(Object.keys(SORT_LABELS) as SortField[]).map((field) => {
              const isActive = sortBy === field
              return (
                <DropdownMenuItem
                  key={field}
                  onClick={() => handleSort(field)}
                  className={cn(isActive && 'font-medium')}
                >
                  {SORT_LABELS[field]}
                  {isActive ? (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {sortOrder === 'asc' ? 'A → Z' : 'Z → A'}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                setParams(
                  { dir: sortOrder === 'asc' ? 'desc' : 'asc' },
                  true,
                )
              }
            >
              Flip direction
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <form onSubmit={submitSearch} className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search name, email, phone…"
            className="h-9 w-64 pl-8"
          />
        </form>

        {!teamSurface ? (
          <Button
            variant={mine ? 'default' : 'outline'}
            size="sm"
            onClick={() => setParams({ mine: mine ? null : '1' })}
          >
            Only mine
          </Button>
        ) : null}
      </div>

      <LeadsTable
        items={leads.items}
        members={members}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSort}
        onConvert={setConvertLead}
        onCreate={() => setCreateOpen(true)}
        onChanged={() => router.refresh()}
      />

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          Page <span className="font-medium text-foreground">{page}</span> of{' '}
          <span className="font-medium text-foreground">{leads.totalPages}</span>
          {' · '}
          {leads.total} total
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs">
            <span>Show</span>
            <select
              value={perPage}
              onChange={(e) =>
                setParams({
                  per_page: e.target.value,
                  // page must reset — a wider window changes what
                  // 'page N' means and can leave the viewer on an
                  // out-of-bounds slice.
                  page: '1',
                })
              }
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm"
            >
              {PER_PAGE_CHOICES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>per page</span>
          </label>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setParams({ page: String(page - 1) }, true)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!leads.hasMore}
              onClick={() => setParams({ page: String(page + 1) }, true)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <ContactsFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        value={filterState}
        members={members}
        onApply={(next) => setParams(contactsFilterToParams(next))}
      />

      <CreateLeadDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={members}
        onCreated={() => router.refresh()}
      />
      <ImportLeadsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        members={members}
        onImported={() => router.refresh()}
      />
      <ConvertLeadDialog
        lead={convertLead}
        onOpenChange={(o) => !o && setConvertLead(null)}
        members={members}
        onConverted={() => router.refresh()}
      />
    </div>
  )
}
