'use client'

// Client container for the pipeline board. Owns the deal list (so
// creates land optimistically), the create dialog, the pipeline
// switcher, and a small summary strip. The board itself manages
// drag-and-drop; the shell just reconciles after a create/move via
// router.refresh().

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Filter,
  KanbanSquare,
  LayoutGrid,
  List,
  Plus,
  Search,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'

import { StatStrip } from '@/components/shared/stat-strip'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import type { OpportunityListItem } from '@/lib/services/crm-opportunity-service'

import {
  bulkAssignCloserAction,
  bulkDeleteOpportunitiesAction,
  bulkMoveOpportunitiesToStageAction,
  type PipelineWorkspacePayload,
} from '@/app/(admin)/admin/crm/opportunities/actions'

import { BulkSelectToolbar } from './bulk-select-toolbar'
import { CreateOpportunityDialog } from './create-opportunity-dialog'
import { EditOpportunityDialog } from './edit-opportunity-dialog'
import { ImportOpportunitiesDialog } from './import-opportunities-dialog'
import { OpportunitiesViewTabs } from './opportunities-view-tabs'
import { OpportunitiesFilterChips } from './opportunities-filter-chips'
import {
  applyOpportunityFilter,
  countActiveFilters,
  EMPTY_FILTER,
  OpportunitiesFilterDrawer,
  type OpportunityFilterState,
} from './opportunities-filter-drawer'
import { OpportunitiesListView } from './opportunities-list-view'
import { OpportunitiesTabs } from './opportunities-tabs'
import {
  OpportunitiesSortMenu,
  sortOpportunities,
  type OpportunitySortBy,
  type OpportunitySortOrder,
} from './opportunities-sort-menu'
import { PipelineBoard } from './pipeline-board'
import { cn } from '@/lib/utils'
import { formatDealValue } from './opportunity-card'

interface PipelineShellProps {
  initialData: PipelineWorkspacePayload
  /** URL base for the board — '/admin/crm/opportunities' or
   *  '/team/crm/opportunities'. Keeps the two surfaces on separate URLs. */
  basePath: string
}

function signatureOf(deals: OpportunityListItem[]): string {
  return deals.map((d) => `${d.id}:${d.stageId}:${d.orderIndex}`).join('|')
}

export function PipelineShell({ initialData, basePath }: PipelineShellProps) {
  const router = useRouter()
  const {
    pipelines,
    currentPipelineId,
    stages,
    members,
    views,
  } = initialData

  const [deals, setDeals] = useState<OpportunityListItem[]>(
    initialData.opportunities,
  )
  // Re-seed local deals whenever the server payload changes (navigation,
  // refresh) — mirror the board's signature-diff reconciliation.
  const lastSignature = useRef(signatureOf(initialData.opportunities))
  const incomingSignature = signatureOf(initialData.opportunities)
  if (incomingSignature !== lastSignature.current) {
    lastSignature.current = incomingSignature
    setDeals(initialData.opportunities)
  }

  const [dialogOpen, setDialogOpen] = useState(false)
  const [createStageId, setCreateStageId] = useState<string | undefined>()
  const [editId, setEditId] = useState<string | null>(null)

  // View toggle — 'board' (Kanban) vs 'list' (compact table). Local
  // state for now; a future revision can persist the choice per user.
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')

  // Sort — only meaningful in list view (board relies on orderIndex
  // for drag-drop). Default 'orderIndex' means "use the pinned order".
  const [sortBy, setSortBy] = useState<OpportunitySortBy>('orderIndex')
  const [sortOrder, setSortOrder] = useState<OpportunitySortOrder>('asc')

  // Advanced filter drawer + its committed state. Applied client-side
  // to the loaded deals so tweaking a facet is instantaneous.
  const [filterOpen, setFilterOpen] = useState(false)
  const [filter, setFilter] = useState<OpportunityFilterState>(EMPTY_FILTER)
  const activeFilterCount = countActiveFilters(filter)

  // Which saved view (if any) is the current filter mirroring.
  // Null = the "All" tab. Applying a view sets both this and `filter`.
  const [activeViewId, setActiveViewId] = useState<string | null>(null)

  // Quick search — applies to both board + list views. Case-insensitive
  // substring on deal name / contact / company.
  const [searchQuery, setSearchQuery] = useState('')

  // Multi-select — used by both the board (Phase 3) and the list view.
  // Shell owns the state so switching views doesn't drop selection.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Pipeline mutation surfaces (create / rename / delete / manage
  // stages) live on the /pipelines sub-tab — the board shell no
  // longer duplicates them.
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [bulkPending, startBulkOp] = useTransition()
  const [importOpen, setImportOpen] = useState(false)

  function toggleSelect(id: string, next: boolean) {
    setSelectedIds((prev) => {
      const s = new Set(prev)
      if (next) s.add(id)
      else s.delete(id)
      return s
    })
  }

  function toggleAll(next: boolean) {
    setSelectedIds(next ? new Set(deals.map((d) => d.id)) : new Set())
  }

  /** Shared toast helper — every bulk action turns its log row into
   *  the same success / partial / failure message shape. */
  function surfaceBulkResult(
    verb: string,
    log: { successCount: number; failureCount: number; targetCount: number },
  ) {
    const { successCount, failureCount, targetCount } = log
    if (failureCount === 0) {
      toast.success(`${verb} ${successCount} ${successCount === 1 ? 'deal' : 'deals'}`)
    } else if (successCount === 0) {
      toast.error(`Bulk action failed for all ${targetCount} deals`)
    } else {
      toast.warning(`${verb} ${successCount} deals — ${failureCount} failed`)
    }
  }

  function runBulkDelete() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    startBulkOp(async () => {
      const res = await bulkDeleteOpportunitiesAction({ opportunityIds: ids })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete deals')
        return
      }
      surfaceBulkResult('Deleted', res.data)
      setDeals((prev) => prev.filter((d) => !selectedIds.has(d.id)))
      setSelectedIds(new Set())
      setBulkConfirmOpen(false)
      router.refresh()
    })
  }

  function runBulkMove(stageId: string) {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    startBulkOp(async () => {
      const res = await bulkMoveOpportunitiesToStageAction({
        opportunityIds: ids,
        stageId,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not move deals')
        return
      }
      surfaceBulkResult('Moved', res.data)
      setSelectedIds(new Set())
      router.refresh()
    })
  }

  function runBulkAssign(closerId: string | null) {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    startBulkOp(async () => {
      const res = await bulkAssignCloserAction({
        opportunityIds: ids,
        closerId,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not assign')
        return
      }
      surfaceBulkResult(closerId ? 'Assigned' : 'Unassigned', res.data)
      setSelectedIds(new Set())
      router.refresh()
    })
  }

  const currentPipeline = pipelines.find((p) => p.id === currentPipelineId)

  // Summary — open pipeline value + probability-weighted forecast.
  const openDeals = deals.filter((d) => d.status === 'OPEN')
  const openValue = openDeals.reduce((sum, d) => sum + (d.value ?? 0), 0)
  const weighted = openDeals.reduce(
    (sum, d) => sum + (d.value ?? 0) * ((d.probability ?? 0) / 100),
    0,
  )
  const wonValue = deals
    .filter((d) => d.status === 'WON')
    .reduce((sum, d) => sum + (d.value ?? 0), 0)

  function openCreate(stageId?: string) {
    setCreateStageId(stageId)
    setDialogOpen(true)
  }

  function handleCreated(deal: OpportunityListItem) {
    setDeals((prev) => [deal, ...prev])
    router.refresh()
  }

  function handleSwitchPipeline(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    router.push(id ? `${basePath}?pipeline=${id}` : basePath)
  }

  return (
    <div className="space-y-3">
      {/* Compact page header — matches HighLevel: pipeline switcher +
          count badge on the left, action rail on the right. No big
          "Opportunities" title (redundant with the sub-tabs below). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={currentPipelineId ?? ''}
            onChange={handleSwitchPipeline}
            aria-label="Switch pipeline"
            disabled={pipelines.length === 0}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-base font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {pipelines.length === 0 ? (
              <option value="">Sales Pipeline</option>
            ) : null}
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {openDeals.length}{' '}
            {openDeals.length === 1 ? 'opportunity' : 'opportunities'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle — board vs list. */}
          <div
            role="group"
            aria-label="View mode"
            className="inline-flex h-9 items-center rounded-md border border-input bg-transparent p-0.5"
          >
            <button
              type="button"
              onClick={() => setViewMode('board')}
              aria-pressed={viewMode === 'board'}
              className={cn(
                'inline-flex size-8 items-center justify-center rounded transition-colors',
                viewMode === 'board'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <LayoutGrid className="size-4" />
              <span className="sr-only">Board view</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
              className={cn(
                'inline-flex size-8 items-center justify-center rounded transition-colors',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <List className="size-4" />
              <span className="sr-only">List view</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={!currentPipelineId}
            onClick={() => setImportOpen(true)}
          >
            <Upload className="size-4" />
            Import
          </Button>

          <Button
            onClick={() => openCreate()}
            disabled={!currentPipelineId}
            size="sm"
          >
            <Plus className="size-4" />
            New opportunity
          </Button>
        </div>
      </div>

      <OpportunitiesTabs basePath={basePath} />

      {/* Saved-view tab strip + Search — sits inside the toolbar rail
          on the right, mirroring HL's layout. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <OpportunitiesViewTabs
            views={views}
            activeViewId={activeViewId}
            currentFilter={filter}
            onSelect={(id, f) => {
              setActiveViewId(id)
              setFilter(f)
            }}
            onChanged={() => router.refresh()}
          />
        </div>
        <div className="relative w-full sm:w-64">
          <Search
            aria-hidden
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search opportunities"
            className="pl-9"
            aria-label="Search opportunities"
          />
        </div>
      </div>

      {/* Filter + Sort rail — left-aligned so it reads as a second
          action line under the tabs. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFilterOpen(true)}
          className={cn(
            activeFilterCount > 0 && 'border-primary/50 text-primary',
          )}
        >
          <Filter className="size-4" />
          Advanced filters
          {activeFilterCount > 0 ? (
            <span className="ml-1 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
        {viewMode === 'list' ? (
          <OpportunitiesSortMenu
            sortBy={sortBy}
            sortOrder={sortOrder}
            onChange={({ sortBy: nb, sortOrder: no }) => {
              setSortBy(nb)
              setSortOrder(no)
            }}
          />
        ) : null}
      </div>

      <OpportunitiesFilterChips
        filter={filter}
        stages={stages}
        members={members}
        onChange={(next) => {
          setFilter(next)
          setActiveViewId(null) // manual edit → drops back to "All"
        }}
      />

      {deals.length > 0 ? (
        // Summary strip only once there are deals — a bare "$0 / $0 /
        // $0" reads as broken on an empty board.
        <StatStrip
          columns={3}
          cells={[
            {
              label: 'Open value',
              value: formatDealValue(openValue) ?? '—',
            },
            {
              label: 'Weighted forecast',
              value: formatDealValue(weighted) ?? '—',
              description: 'Σ value × probability',
            },
            {
              label: 'Won',
              value: formatDealValue(wonValue) ?? '—',
              valueClassName: 'text-emerald-600',
            },
          ]}
        />
      ) : (
        // Empty board still shows its stages below — just nudge toward
        // the first deal instead of a $0 strip.
        <p className="flex items-center gap-2 rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <KanbanSquare className="size-4 shrink-0" aria-hidden />
          No deals yet — add one to a stage below, or convert a qualified
          contact from Contacts.
        </p>
      )}

      {(() => {
        const q = searchQuery.trim().toLowerCase()
        const searchFiltered = q
          ? deals.filter(
              (d) =>
                d.name.toLowerCase().includes(q) ||
                (d.contactName?.toLowerCase().includes(q) ?? false) ||
                (d.companyName?.toLowerCase().includes(q) ?? false),
            )
          : deals
        const filtered = applyOpportunityFilter(searchFiltered, filter)
        return viewMode === 'board' ? (
          // Board is always visible in this mode so the stages read as
          // a pipeline even before the first deal lands.
          <PipelineBoard
            stages={stages}
            opportunities={filtered}
            onOpen={setEditId}
            onCreate={openCreate}
            onChanged={() => router.refresh()}
          />
        ) : (
          <OpportunitiesListView
            stages={stages}
            opportunities={sortOpportunities(filtered, sortBy, sortOrder)}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
            onOpen={setEditId}
          />
        )
      })()}

      <OpportunitiesFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        value={filter}
        stages={stages}
        members={members}
        onApply={(next) => {
          setFilter(next)
          setActiveViewId(null) // manual apply → drops back to "All"
        }}
      />

      {currentPipelineId ? (
        <ImportOpportunitiesDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          pipelineId={currentPipelineId}
          members={members}
          onImported={() => router.refresh()}
        />
      ) : null}

      <BulkSelectToolbar
        selectedCount={selectedIds.size}
        stages={stages}
        members={members}
        onClear={() => setSelectedIds(new Set())}
        onMoveToStage={runBulkMove}
        onAssignCloser={runBulkAssign}
        onDelete={() => setBulkConfirmOpen(true)}
        disabled={bulkPending}
      />

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size}{' '}
              {selectedIds.size === 1 ? 'deal' : 'deals'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Selected deals will be soft-deleted and closed as lost. Run
              history stays visible on the Bulk Actions tab. This can’t
              be undone from the UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                runBulkDelete()
              }}
              disabled={bulkPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkPending ? 'Deleting…' : 'Delete deals'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {currentPipelineId ? (
        <CreateOpportunityDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          pipelineId={currentPipelineId}
          pipelines={pipelines}
          stages={stages}
          members={members}
          defaultStageId={createStageId}
          onCreated={handleCreated}
        />
      ) : null}

      <EditOpportunityDialog
        opportunityId={editId}
        pipelines={pipelines}
        currentPipelineId={currentPipelineId}
        stages={stages}
        members={members}
        onOpenChange={(open) => !open && setEditId(null)}
        onChanged={() => router.refresh()}
      />

    </div>
  )
}

