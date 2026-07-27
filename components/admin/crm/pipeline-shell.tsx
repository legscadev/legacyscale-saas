'use client'

// Client container for the pipeline board. Owns the deal list (so
// creates land optimistically), the create dialog, the pipeline
// switcher, and a small summary strip. The board itself manages
// drag-and-drop; the shell just reconciles after a create/move via
// router.refresh().

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KanbanSquare, Plus } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'

import type { OpportunityListItem } from '@/lib/services/crm-opportunity-service'

import type { PipelineWorkspacePayload } from '@/app/(admin)/admin/crm/pipeline/actions'

import { CreateOpportunityDialog } from './create-opportunity-dialog'
import { PipelineBoard } from './pipeline-board'
import { formatDealValue } from './opportunity-card'

interface PipelineShellProps {
  initialData: PipelineWorkspacePayload
  /** URL base for the pipeline switcher — '/admin/crm/pipeline' or
   *  '/team/crm/pipeline'. Keeps the two surfaces on their own URLs. */
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
    <div className="space-y-4">
      <PageHeader
        title="Pipeline"
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

      {deals.length > 0 ? (
        // Summary strip only once there are deals — a bare "$0 / $0 /
        // $0" reads as broken on an empty board.
        <div className="flex flex-wrap gap-4 rounded-xl border bg-muted/30 px-4 py-3 text-sm">
          <SummaryStat label="Open value" value={formatDealValue(openValue)} />
          <SummaryStat
            label="Weighted forecast"
            value={formatDealValue(weighted)}
            hint="Σ value × probability"
          />
          <SummaryStat
            label="Won"
            value={formatDealValue(wonValue)}
            tone="emerald"
          />
        </div>
      ) : (
        // Empty board still shows its stages below — just nudge toward
        // the first deal instead of a $0 strip.
        <p className="flex items-center gap-2 rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <KanbanSquare className="size-4 shrink-0" aria-hidden />
          No deals yet — add one to a stage below, or convert a qualified lead
          from the Leads inbox.
        </p>
      )}

      {/* The Kanban board is always visible so the stages read as a
          pipeline even before the first deal lands. */}
      <PipelineBoard
        stages={stages}
        opportunities={deals}
        onCreate={openCreate}
        onChanged={() => router.refresh()}
      />

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
    </div>
  )
}

function SummaryStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string | null
  hint?: string
  tone?: 'emerald'
}) {
  return (
    <div className="min-w-[8rem]">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={
          tone === 'emerald'
            ? 'text-lg font-semibold tabular-nums text-emerald-600'
            : 'text-lg font-semibold tabular-nums'
        }
      >
        {value ?? '—'}
      </p>
      {hint ? (
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
