'use client'

// The CRM pipeline Kanban. One column per stage, deal cards ordered
// by orderIndex within their column. Drag-and-drop moves a deal
// between stages (stage change → may flip WON/LOST) and reorders
// within a column (orderIndex change). Both go through
// moveOpportunityAction.
//
// Optimistic strategy + collision detection are lifted from the Task
// Tracker board (components/admin/tasks/kanban-board.tsx): mutate the
// local columns on drop for an instant response, run the server
// action in a transition, roll back + toast on error.

import { useMemo, useRef, useState, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { KanbanSquare } from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'

import type { OpportunityListItem } from '@/lib/services/crm-opportunity-service'
import type { PipelineStage } from '@/lib/services/crm-pipeline-service'

import { moveOpportunityAction } from '@/app/(admin)/admin/crm/opportunities/actions'

import { OpportunityCard, formatDealValue } from './opportunity-card'

interface PipelineBoardProps {
  stages: PipelineStage[]
  opportunities: OpportunityListItem[]
  onOpen?: (id: string) => void
  onCreate?: (stageId: string) => void
  /** Called after a successful move so the shell can revalidate. */
  onChanged?: () => void
}

interface Column {
  id: string
  name: string
  color: string
  wipLimit: number | null
  deals: OpportunityListItem[]
}

/** Custom collision detection — pointer-first with rect + closest-
 *  corners fallbacks so empty columns still accept drops. Identical
 *  to the Task Tracker board's resolver. */
const detectCollisions: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args)
  if (pointerHits.length > 0) return pointerHits
  const rectHits = rectIntersection(args)
  if (rectHits.length > 0) return rectHits
  return closestCorners(args)
}

const ORDER_STEP = 100

function groupByStage(
  stages: PipelineStage[],
  deals: OpportunityListItem[],
): Column[] {
  const byStage = new Map<string, OpportunityListItem[]>()
  for (const d of deals) {
    const list = byStage.get(d.stageId) ?? []
    list.push(d)
    byStage.set(d.stageId, list)
  }
  return stages.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    wipLimit: s.wipLimit,
    deals: (byStage.get(s.id) ?? [])
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex),
  }))
}

/** orderIndex for a card landing at `insertAt`, midpoint between
 *  neighbours (ends fall back to first-STEP / last+STEP). */
function computeInsertedOrderIndex(
  columnDeals: OpportunityListItem[],
  insertAt: number,
): number {
  if (columnDeals.length === 0) return ORDER_STEP
  if (insertAt <= 0) return columnDeals[0]!.orderIndex - ORDER_STEP
  if (insertAt >= columnDeals.length) {
    return columnDeals[columnDeals.length - 1]!.orderIndex + ORDER_STEP
  }
  const prev = columnDeals[insertAt - 1]!.orderIndex
  const next = columnDeals[insertAt]!.orderIndex
  return Math.floor((prev + next) / 2)
}

export function PipelineBoard({
  stages,
  opportunities,
  onOpen,
  onCreate,
  onChanged,
}: PipelineBoardProps) {
  const [columns, setColumns] = useState<Column[]>(() =>
    groupByStage(stages, opportunities),
  )
  const initialSignature = useRef(signatureOf(opportunities))
  const currentSignature = signatureOf(opportunities)
  if (currentSignature !== initialSignature.current) {
    initialSignature.current = currentSignature
    setColumns(groupByStage(stages, opportunities))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const [activeId, setActiveId] = useState<string | null>(null)
  const [, startMutation] = useTransition()
  const preDragSnapshot = useRef<Column[] | null>(null)

  const activeDeal = useMemo(() => {
    if (!activeId) return null
    for (const col of columns) {
      const found = col.deals.find((d) => d.id === activeId)
      if (found) return found
    }
    return null
  }, [activeId, columns])

  function findColumnByDeal(dealId: string): Column | undefined {
    return columns.find((c) => c.deals.some((d) => d.id === dealId))
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
    preDragSnapshot.current = columns
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)

    const activeCol = findColumnByDeal(activeIdStr)
    if (!activeCol) return

    const overCol =
      columns.find((c) => c.id === overIdStr) ?? findColumnByDeal(overIdStr)
    if (!overCol || overCol.id === activeCol.id) return

    setColumns((prev) => {
      const next = prev.map((c) => ({ ...c, deals: [...c.deals] }))
      const from = next.find((c) => c.id === activeCol.id)!
      const to = next.find((c) => c.id === overCol.id)!
      const idx = from.deals.findIndex((d) => d.id === activeIdStr)
      if (idx === -1) return prev
      const [moved] = from.deals.splice(idx, 1)
      if (!moved) return prev

      const overIdxInTarget = to.deals.findIndex((d) => d.id === overIdStr)
      const insertAt =
        overIdxInTarget === -1 ? to.deals.length : overIdxInTarget
      to.deals.splice(insertAt, 0, { ...moved, stageId: to.id })
      return next
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) {
      preDragSnapshot.current = null
      return
    }

    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)

    const targetCol = findColumnByDeal(activeIdStr)
    if (!targetCol) {
      preDragSnapshot.current = null
      return
    }

    let insertAt = targetCol.deals.findIndex((d) => d.id === activeIdStr)
    if (insertAt === -1) {
      const overIdxInTarget = targetCol.deals.findIndex(
        (d) => d.id === overIdStr,
      )
      insertAt =
        overIdxInTarget === -1 ? targetCol.deals.length : overIdxInTarget
    }

    const neighbours = targetCol.deals.filter((d) => d.id !== activeIdStr)
    const orderIndex = computeInsertedOrderIndex(neighbours, insertAt)

    setColumns((prev) =>
      prev.map((c) => ({
        ...c,
        deals: c.deals.map((d) =>
          d.id === activeIdStr ? { ...d, orderIndex } : d,
        ),
      })),
    )

    const snapshot = preDragSnapshot.current
    preDragSnapshot.current = null

    startMutation(async () => {
      const res = await moveOpportunityAction({
        opportunityId: activeIdStr,
        stageId: targetCol.id,
        orderIndex,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not move deal')
        if (snapshot) setColumns(snapshot)
        return
      }
      onChanged?.()
    })
  }

  function handleDragCancel() {
    setActiveId(null)
    if (preDragSnapshot.current) {
      setColumns(preDragSnapshot.current)
      preDragSnapshot.current = null
    }
  }

  if (stages.length === 0) {
    return (
      <EmptyState
        icon={KanbanSquare}
        title="No pipeline yet"
        description="A default pipeline is created on first visit. Reload if you don't see any stages."
      />
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detectCollisions}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="-mx-2 overflow-x-auto pb-2">
        <div className="flex min-w-full gap-3 px-2">
          {columns.map((col) => (
            <BoardColumn
              key={col.id}
              column={col}
              onOpen={onOpen}
              onCreate={onCreate}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDeal ? (
          <div className="w-72 rotate-1">
            <OpportunityCard opportunity={activeDeal} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function signatureOf(deals: OpportunityListItem[]): string {
  return deals.map((d) => `${d.id}:${d.stageId}:${d.orderIndex}`).join('|')
}

// =========================================================
// Column
// =========================================================

interface BoardColumnProps {
  column: Column
  onOpen?: (id: string) => void
  onCreate?: (stageId: string) => void
}

function BoardColumn({ column, onOpen, onCreate }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  const overWip =
    column.wipLimit !== null && column.deals.length > column.wipLimit

  const total = column.deals.reduce((sum, d) => sum + (d.value ?? 0), 0)
  const totalLabel = formatDealValue(total)

  return (
    <section
      ref={setNodeRef}
      aria-label={`${column.name} column`}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors',
        isOver && 'border-primary/40 bg-primary/5',
      )}
    >
      <header
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderTopColor: column.color, borderTopWidth: 3 }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: column.color }}
            aria-hidden
          />
          <p className="truncate text-sm font-medium">{column.name}</p>
          <span
            className={cn(
              'rounded-full bg-background px-1.5 text-[10px] font-semibold text-muted-foreground tabular-nums',
              overWip && 'bg-rose-100 text-rose-700',
            )}
          >
            {column.deals.length}
            {column.wipLimit !== null ? `/${column.wipLimit}` : null}
          </span>
        </div>
        {totalLabel && total > 0 ? (
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
            {totalLabel}
          </span>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col gap-2 p-2">
        <SortableContext
          items={column.deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.deals.length === 0 ? (
            <button
              type="button"
              onClick={() => onCreate?.(column.id)}
              className={cn(
                'flex h-24 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground',
                'transition-colors hover:border-primary/40 hover:text-foreground',
              )}
            >
              Drop deals here or add one
            </button>
          ) : (
            column.deals.map((deal) => (
              <SortableOpportunityCard
                key={deal.id}
                opportunity={deal}
                onOpen={onOpen ? () => onOpen(deal.id) : undefined}
              />
            ))
          )}
        </SortableContext>
      </div>
    </section>
  )
}

// =========================================================
// Sortable card wrapper
// =========================================================

interface SortableOpportunityCardProps {
  opportunity: OpportunityListItem
  onOpen?: () => void
}

function SortableOpportunityCard({
  opportunity,
  onOpen,
}: SortableOpportunityCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: opportunity.id })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <OpportunityCard
      ref={setNodeRef}
      opportunity={opportunity}
      isDragging={isDragging}
      onOpen={onOpen}
      style={style}
      {...attributes}
      {...listeners}
    />
  )
}
