'use client'

// Client container for the lead inbox. Filters are URL-driven (the
// page is force-dynamic and re-fetches on searchParams change), so
// the shell just reads current params via useSearchParams and pushes
// new ones. Row mutations + dialog submits reconcile via
// router.refresh().

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Search, Upload } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { LeadListItem } from '@/lib/services/crm-lead-service'
import {
  CRM_LEAD_SOURCE_LABELS,
  CRM_LEAD_STATUS_LABELS,
  type CrmLeadSourceValue,
  type CrmLeadStatusValue,
} from '@/lib/validations/crm-lead'

import type { LeadsWorkspacePayload } from '@/app/(admin)/admin/crm/leads/actions'

import { ConvertLeadDialog } from './convert-lead-dialog'
import { CreateLeadDialog } from './create-lead-dialog'
import { ImportLeadsDialog } from './import-leads-dialog'
import { LeadsTable } from './leads-table'

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

type SortField = 'createdAt' | 'lastActivityAt' | 'fullName' | 'status'

interface LeadsShellProps {
  initialData: LeadsWorkspacePayload
  basePath: string
  /** Team surface pins the "mine" filter on and hides the toggle. */
  teamSurface?: boolean
}

export function LeadsShell({ initialData, basePath, teamSurface }: LeadsShellProps) {
  const router = useRouter()
  const params = useSearchParams()
  const { leads, members } = initialData

  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [convertLead, setConvertLead] = useState<LeadListItem | null>(null)
  const [searchDraft, setSearchDraft] = useState(params.get('q') ?? '')

  const status = params.get('status') ?? ''
  const source = params.get('source') ?? ''
  const mine = params.get('mine') === '1'
  const sortBy = (params.get('sort') as SortField) ?? 'createdAt'
  const sortOrder = params.get('dir') === 'asc' ? 'asc' : 'desc'

  /** Push a new query string, resetting page unless paging. */
  function setParams(next: Record<string, string | null>, keepPage = false) {
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
        description={`${leads.total} lead${leads.total === 1 ? '' : 's'} in the inbox`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" />
              Import
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New lead
            </Button>
          </div>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={submitSearch} className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search name, email, phone…"
            className="h-9 w-64 pl-8"
          />
        </form>

        <select
          value={status}
          onChange={(e) => setParams({ status: e.target.value || null })}
          className={SELECT_CLASS}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {(Object.keys(CRM_LEAD_STATUS_LABELS) as CrmLeadStatusValue[]).map((s) => (
            <option key={s} value={s}>
              {CRM_LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <select
          value={source}
          onChange={(e) => setParams({ source: e.target.value || null })}
          className={SELECT_CLASS}
          aria-label="Filter by source"
        >
          <option value="">All sources</option>
          {(Object.keys(CRM_LEAD_SOURCE_LABELS) as CrmLeadSourceValue[]).map((s) => (
            <option key={s} value={s}>
              {CRM_LEAD_SOURCE_LABELS[s]}
            </option>
          ))}
        </select>

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
      {leads.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Page <span className="font-medium text-foreground">{page}</span> of{' '}
            <span className="font-medium text-foreground">{leads.totalPages}</span>
          </p>
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
      ) : null}

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
