'use client'

// Client container for the pipeline board. Owns the deal list (so
// creates land optimistically), the create dialog, the pipeline
// switcher, and a small summary strip. The board itself manages
// drag-and-drop; the shell just reconciles after a create/move via
// router.refresh().

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  KanbanSquare,
  LayoutGrid,
  List,
  ListChecks,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { StatStrip } from '@/components/shared/stat-strip'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import type { OpportunityListItem } from '@/lib/services/crm-opportunity-service'

import {
  bulkDeleteOpportunitiesAction,
  deletePipelineAction,
  renamePipelineAction,
  type PipelineWorkspacePayload,
} from '@/app/(admin)/admin/crm/opportunities/actions'

import { BulkSelectToolbar } from './bulk-select-toolbar'
import { CreateOpportunityDialog } from './create-opportunity-dialog'
import { CreatePipelineDialog } from './create-pipeline-dialog'
import { EditOpportunityDialog } from './edit-opportunity-dialog'
import { ManageStagesDialog } from './manage-stages-dialog'
import { OpportunitiesListView } from './opportunities-list-view'
import { OpportunitiesTabs } from './opportunities-tabs'
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

  // Multi-select — used by both the board (Phase 3) and the list view.
  // Shell owns the state so switching views doesn't drop selection.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Pipeline management
  const [createPipelineOpen, setCreatePipelineOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [stagesOpen, setStagesOpen] = useState(false)
  const [pipelinePending, startPipelineOp] = useTransition()
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [bulkPending, startBulkOp] = useTransition()

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

  function runBulkDelete() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    startBulkOp(async () => {
      const res = await bulkDeleteOpportunitiesAction({ opportunityIds: ids })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete deals')
        return
      }
      const { successCount, failureCount, targetCount } = res.data
      if (failureCount === 0) {
        toast.success(`Deleted ${successCount} deals`)
      } else if (successCount === 0) {
        toast.error(`Delete failed for all ${targetCount} deals`)
      } else {
        toast.warning(
          `Deleted ${successCount} deals — ${failureCount} failed`,
        )
      }
      // Local optimistic pull so the removed cards vanish instantly.
      setDeals((prev) => prev.filter((d) => !selectedIds.has(d.id)))
      setSelectedIds(new Set())
      setBulkConfirmOpen(false)
      router.refresh()
    })
  }

  const currentPipeline = pipelines.find((p) => p.id === currentPipelineId)

  function submitRename(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPipelineId || !renameValue.trim()) return
    startPipelineOp(async () => {
      const res = await renamePipelineAction({
        pipelineId: currentPipelineId,
        name: renameValue.trim(),
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not rename pipeline')
        return
      }
      toast.success('Pipeline renamed')
      setRenameOpen(false)
      router.refresh()
    })
  }

  function confirmDeletePipeline() {
    if (!currentPipelineId) return
    startPipelineOp(async () => {
      const res = await deletePipelineAction(currentPipelineId)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete pipeline')
        return
      }
      toast.success('Pipeline deleted')
      setDeleteOpen(false)
      // Drop the ?pipeline= param so the page falls back to the default.
      router.push(basePath)
    })
  }

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
    <div className="space-y-4">
      <PageHeader
        title="Opportunities"
        description={
          currentPipeline
            ? `${currentPipeline.name} · ${openDeals.length} open ${
                openDeals.length === 1 ? 'deal' : 'deals'
              }`
            : 'Sales pipeline'
        }
        actions={
          <div className="flex items-center gap-2">
            {pipelines.length > 1 ? (
              <select
                value={currentPipelineId ?? ''}
                onChange={handleSwitchPipeline}
                aria-label="Switch pipeline"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : null}

            {/* View toggle — board vs list. Segmented pair sits on its
                own rail so the Pipelines dropdown + New deal buttons
                keep their existing prominence. */}
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

            {/* Manage pipelines */}
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Manage pipelines"
                render={
                  <Button variant="outline" size="sm" disabled={pipelinePending} />
                }
              >
                <Settings2 className="size-4" />
                Pipelines
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setCreatePipelineOpen(true)}>
                  <Plus className="size-4" />
                  New pipeline
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!currentPipeline}
                  onClick={() => setStagesOpen(true)}
                >
                  <ListChecks className="size-4" />
                  Manage stages
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!currentPipeline}
                  onClick={() => {
                    setRenameValue(currentPipeline?.name ?? '')
                    setRenameOpen(true)
                  }}
                >
                  <Pencil className="size-4" />
                  Rename current
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={!currentPipeline || pipelines.length <= 1}
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                  Delete current
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={() => openCreate()}
              disabled={!currentPipelineId}
              size="sm"
            >
              <Plus className="size-4" />
              New deal
            </Button>
          </div>
        }
      />

      <OpportunitiesTabs basePath={basePath} />

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

      {viewMode === 'board' ? (
        // Board is always visible in this mode so the stages read as
        // a pipeline even before the first deal lands.
        <PipelineBoard
          stages={stages}
          opportunities={deals}
          onOpen={setEditId}
          onCreate={openCreate}
          onChanged={() => router.refresh()}
        />
      ) : (
        <OpportunitiesListView
          stages={stages}
          opportunities={deals}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleAll={toggleAll}
          onOpen={setEditId}
        />
      )}

      <BulkSelectToolbar
        selectedCount={selectedIds.size}
        onClear={() => setSelectedIds(new Set())}
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
          stages={stages}
          members={members}
          defaultStageId={createStageId}
          onCreated={handleCreated}
        />
      ) : null}

      <EditOpportunityDialog
        opportunityId={editId}
        stages={stages}
        members={members}
        onOpenChange={(open) => !open && setEditId(null)}
        onChanged={() => router.refresh()}
      />

      <CreatePipelineDialog
        open={createPipelineOpen}
        onOpenChange={setCreatePipelineOpen}
        onCreated={(pipeline) => router.push(`${basePath}?pipeline=${pipeline.id}`)}
      />

      <ManageStagesDialog
        open={stagesOpen}
        pipelineId={currentPipelineId}
        pipelineName={currentPipeline?.name ?? 'Pipeline'}
        onOpenChange={setStagesOpen}
        onChanged={() => router.refresh()}
      />

      {/* Rename current pipeline */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={submitRename}>
            <DialogHeader>
              <DialogTitle>Rename pipeline</DialogTitle>
              <DialogDescription>
                Give this pipeline a clearer name.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5 py-4">
              <Label htmlFor="rename-pipeline">Name</Label>
              <Input
                id="rename-pipeline"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
                disabled={pipelinePending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pipelinePending}>
                {pipelinePending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete current pipeline */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete “{currentPipeline?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A pipeline can only be deleted once it holds no deals. Move or
              delete its deals first, or this will refuse. This can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pipelinePending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmDeletePipeline()
              }}
              disabled={pipelinePending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pipelinePending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

