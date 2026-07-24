'use client'

// The Kanban board — one column per tenant status, cards ordered
// by orderIndex within their column. Drag-and-drop moves cards
// between columns (status change) and reorders within a column
// (orderIndex change). Both paths go through changeTaskStatusAction
// which does the same DB write regardless.
//
// Optimistic strategy: on dragEnd we immediately mutate the local
// column arrays so the card lands in its new position without a
// server round trip flash. The server action runs in the
// background; router.refresh() at the end reconciles any drift.
// On error we roll back to the pre-drag snapshot + toast.

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
import { CheckSquare } from 'lucide-react'
import { toast } from 'sonner'

import { changeTaskStatusAction } from '@/app/(admin)/admin/tasks/actions'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'

import type { WorkflowStatus } from '@/app/(admin)/admin/tasks/actions'
import type { TaskListItem } from '@/lib/services/task-service'

import { KanbanCard } from './kanban-card'

interface KanbanBoardProps {
  statuses: WorkflowStatus[]
  tasks: TaskListItem[]
  onOpenTask?: (id: string) => void
  onCreate?: () => void
  /** Called after a successful move so the shell can revalidate
   *  the workspace (stat strip counts + reconciled orderIndex). */
  onChanged?: () => void
}

interface Column {
  id: string
  name: string
  color: string
  isTerminal: boolean
  wipLimit: number | null
  tasks: TaskListItem[]
}

/** Synthetic column id for orphaned tasks — cards in this bucket
 *  can be dragged out, but can't be dropped in (no real statusId). */
const ORPHAN_COLUMN_ID = '__orphans__'

/**
 * Custom collision detection for the Kanban board.
 *
 * The default `closestCorners` picks the droppable whose corners are
 * closest to the dragged item. That works well when every column
 * has cards, but breaks empty columns: the column's rect is small
 * (just the header + a placeholder) so the closest "corner" ends up
 * being a neighbouring card in a different column, and the drop
 * silently lands there instead of the empty target.
 *
 * The canonical dnd-kit fix is a fallback chain:
 *   1. `pointerWithin` — if the pointer is directly inside a
 *      droppable (including the whole column rect), that wins.
 *      Handles the empty-column case cleanly.
 *   2. `rectIntersection` — if the dragged rect overlaps a droppable
 *      but the pointer isn't strictly inside. Covers edge cases
 *      like dragging with a large overlay.
 *   3. `closestCorners` — original behaviour as a last resort.
 */
const detectKanbanCollisions: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args)
  if (pointerHits.length > 0) return pointerHits
  const rectHits = rectIntersection(args)
  if (rectHits.length > 0) return rectHits
  return closestCorners(args)
}

function groupTasksByStatus(
  statuses: WorkflowStatus[],
  tasks: TaskListItem[],
): Column[] {
  const byStatus = new Map<string, TaskListItem[]>()
  for (const t of tasks) {
    const list = byStatus.get(t.statusId) ?? []
    list.push(t)
    byStatus.set(t.statusId, list)
  }
  const columns: Column[] = statuses.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    isTerminal: s.isTerminal,
    wipLimit: s.wipLimit,
    tasks: (byStatus.get(s.id) ?? [])
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex),
  }))

  const known = new Set(statuses.map((s) => s.id))
  const orphans = tasks.filter((t) => !known.has(t.statusId))
  if (orphans.length > 0) {
    columns.push({
      id: ORPHAN_COLUMN_ID,
      name: 'Uncategorized',
      color: '#64748b',
      isTerminal: false,
      wipLimit: null,
      tasks: orphans.slice().sort((a, b) => a.orderIndex - b.orderIndex),
    })
  }
  return columns
}

/** orderIndex step keeps single-card moves from touching neighbours.
 *  Matches the task-service default. */
const ORDER_STEP = 100

/** Compute the orderIndex a card should carry after landing at
 *  `insertAt` in the target column. Uses the midpoint between
 *  neighbours; falls back to firstIndex - ORDER_STEP / lastIndex +
 *  ORDER_STEP at the ends. */
function computeInsertedOrderIndex(
  columnTasks: TaskListItem[],
  insertAt: number,
): number {
  if (columnTasks.length === 0) return ORDER_STEP
  if (insertAt <= 0) return columnTasks[0]!.orderIndex - ORDER_STEP
  if (insertAt >= columnTasks.length) {
    return columnTasks[columnTasks.length - 1]!.orderIndex + ORDER_STEP
  }
  const prev = columnTasks[insertAt - 1]!.orderIndex
  const next = columnTasks[insertAt]!.orderIndex
  return Math.floor((prev + next) / 2)
}

export function KanbanBoard({
  statuses,
  tasks,
  onOpenTask,
  onCreate,
  onChanged,
}: KanbanBoardProps) {
  // Local mirror of the initial payload — every drop mutates this
  // synchronously so the UI reacts before the server responds. The
  // upstream `tasks` prop only re-hydrates via router.refresh(); we
  // rebuild columns from it whenever it changes.
  const [columns, setColumns] = useState<Column[]>(() =>
    groupTasksByStatus(statuses, tasks),
  )
  const initialSignature = useRef(signatureOf(tasks))
  const currentSignature = signatureOf(tasks)
  if (currentSignature !== initialSignature.current) {
    // Upstream re-hydration → snap back to the server truth.
    initialSignature.current = currentSignature
    setColumns(groupTasksByStatus(statuses, tasks))
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

  const activeTask = useMemo(() => {
    if (!activeId) return null
    for (const col of columns) {
      const found = col.tasks.find((t) => t.id === activeId)
      if (found) return found
    }
    return null
  }, [activeId, columns])

  function findColumnByTask(taskId: string): Column | undefined {
    return columns.find((c) => c.tasks.some((t) => t.id === taskId))
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
    preDragSnapshot.current = columns
  }

  /**
   * Live cross-column preview. Runs continuously while the pointer
   * hovers a different column so the card visually "moves" before
   * the operator releases. Same-column moves are handled by
   * SortableContext internally.
   */
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)

    const activeCol = findColumnByTask(activeIdStr)
    if (!activeCol) return

    // over.id may be either a task id (hovering another card) or a
    // column id (hovering the column's droppable region). Normalize.
    const overCol =
      columns.find((c) => c.id === overIdStr) ??
      findColumnByTask(overIdStr)
    if (!overCol || overCol.id === activeCol.id) return
    if (overCol.id === ORPHAN_COLUMN_ID) return

    setColumns((prev) => {
      const next = prev.map((c) => ({ ...c, tasks: [...c.tasks] }))
      const from = next.find((c) => c.id === activeCol.id)!
      const to = next.find((c) => c.id === overCol.id)!
      const idx = from.tasks.findIndex((t) => t.id === activeIdStr)
      if (idx === -1) return prev
      const [moved] = from.tasks.splice(idx, 1)
      if (!moved) return prev

      // Insert at the hovered card's position, or at the end when
      // hovering the column background.
      const overIdxInTarget = to.tasks.findIndex((t) => t.id === overIdStr)
      const insertAt =
        overIdxInTarget === -1 ? to.tasks.length : overIdxInTarget
      to.tasks.splice(insertAt, 0, { ...moved, statusId: to.id })
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

    const targetCol = findColumnByTask(activeIdStr)
    if (!targetCol) {
      preDragSnapshot.current = null
      return
    }

    // Compute the final index within the target column. Same-column
    // reorders come through here too — SortableContext already
    // reorders visually; we still need to persist the new order.
    let insertAt = targetCol.tasks.findIndex((t) => t.id === activeIdStr)
    if (insertAt === -1) {
      // Cross-column case — findColumnByTask returned the *destination*
      // because handleDragOver already moved the card. Recompute
      // against the original snapshot.
      const overIdxInTarget = targetCol.tasks.findIndex(
        (t) => t.id === overIdStr,
      )
      insertAt =
        overIdxInTarget === -1 ? targetCol.tasks.length : overIdxInTarget
    }

    if (targetCol.id === ORPHAN_COLUMN_ID) {
      // Should never happen thanks to handleDragOver's guard, but
      // roll back defensively.
      if (preDragSnapshot.current) setColumns(preDragSnapshot.current)
      preDragSnapshot.current = null
      return
    }

    // Build the "other tasks" list (excluding the moved card) so
    // computeInsertedOrderIndex sees stable neighbours.
    const neighbours = targetCol.tasks.filter((t) => t.id !== activeIdStr)
    const orderIndex = computeInsertedOrderIndex(neighbours, insertAt)

    // Optimistic update — patch the moved card's orderIndex locally.
    setColumns((prev) =>
      prev.map((c) => ({
        ...c,
        tasks: c.tasks.map((t) =>
          t.id === activeIdStr ? { ...t, orderIndex } : t,
        ),
      })),
    )

    const snapshot = preDragSnapshot.current
    preDragSnapshot.current = null

    startMutation(async () => {
      const res = await changeTaskStatusAction({
        taskId: activeIdStr,
        statusId: targetCol.id,
        orderIndex,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not move task')
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

  if (columns.length === 0) {
    return (
      <EmptyState
        icon={CheckSquare}
        title="No columns yet"
        description="Configure statuses under Workflow admin (Phase 6) to see them here."
      />
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={detectKanbanCollisions}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="-mx-2 overflow-x-auto pb-2">
        <div className="flex min-w-full gap-3 px-2">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              onOpenTask={onOpenTask}
              onCreate={onCreate}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-72 rotate-1">
            <KanbanCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

/** Signature that changes whenever the upstream tasks list shifts.
 *  Cheap enough — id + statusId + orderIndex per row. */
function signatureOf(tasks: TaskListItem[]): string {
  return tasks
    .map((t) => `${t.id}:${t.statusId}:${t.orderIndex}`)
    .join('|')
}

// =========================================================
// Column
// =========================================================

interface KanbanColumnProps {
  column: Column
  onOpenTask?: (id: string) => void
  onCreate?: () => void
}

function KanbanColumn({ column, onOpenTask, onCreate }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    disabled: column.id === ORPHAN_COLUMN_ID,
  })
  const overWip =
    column.wipLimit !== null && column.tasks.length > column.wipLimit
  const isOrphan = column.id === ORPHAN_COLUMN_ID

  return (
    <section
      ref={setNodeRef}
      aria-label={`${column.name} column`}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors',
        isOver && !isOrphan && 'border-primary/40 bg-primary/5',
      )}
    >
      <header
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderTopColor: column.color, borderTopWidth: 3 }}
      >
        <div className="flex items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: column.color }}
            aria-hidden
          />
          <p className="text-sm font-medium">{column.name}</p>
          <span
            className={cn(
              'rounded-full bg-background px-1.5 text-[10px] font-semibold text-muted-foreground tabular-nums',
              overWip && 'bg-rose-100 text-rose-700',
            )}
          >
            {column.tasks.length}
            {column.wipLimit !== null ? `/${column.wipLimit}` : null}
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2 p-2">
        <SortableContext
          items={column.tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.tasks.length === 0 ? (
            isOrphan ? null : (
              <button
                type="button"
                onClick={onCreate}
                className={cn(
                  'flex h-24 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground',
                  'transition-colors hover:border-primary/40 hover:text-foreground',
                )}
              >
                Drop tasks here or create one
              </button>
            )
          ) : (
            column.tasks.map((task) => (
              <SortableKanbanCard
                key={task.id}
                task={task}
                onOpen={onOpenTask ? () => onOpenTask(task.id) : undefined}
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

interface SortableKanbanCardProps {
  task: TaskListItem
  onOpen?: () => void
}

function SortableKanbanCard({ task, onOpen }: SortableKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  return (
    <KanbanCard
      ref={setNodeRef}
      task={task}
      isDragging={isDragging}
      onOpen={onOpen}
      style={style}
      {...attributes}
      {...listeners}
    />
  )
}
