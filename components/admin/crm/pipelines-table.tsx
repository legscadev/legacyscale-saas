'use client'

// Pipelines management table. Lists every pipeline in the tenant with
// stage count + last-updated stamp; supports drag-to-reorder,
// per-row rename / manage-stages / delete via a kebab menu; and
// creating new pipelines via a header button.
//
// Drag-drop uses @dnd-kit/sortable — same primitive the board uses so
// there's one story for reorder in the CRM. Reorders apply
// optimistically and reconcile with router.refresh() on success.

import { useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Copy,
  ExternalLink,
  GripVertical,
  KanbanSquare,
  Link2,
  ListChecks,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'

import {
  deletePipelineAction,
  duplicatePipelineAction,
  renamePipelineAction,
  reorderPipelinesAction,
} from '@/app/(admin)/admin/crm/opportunities/actions'
import type { PipelineListRow } from '@/lib/services/crm-pipeline-service'

import { CreatePipelineDialog } from './create-pipeline-dialog'
import { ManageStagesDialog } from './manage-stages-dialog'

interface PipelinesTableProps {
  initialPipelines: PipelineListRow[]
  /** Board URL — clicking a pipeline row opens the board scoped to it. */
  boardBasePath: string
}

function signaturePipelines(rows: PipelineListRow[]): string {
  return rows.map((r) => `${r.id}:${r.name}:${r.orderIndex}:${r.stageCount}`).join('|')
}

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
function formatUpdated(date: Date): string {
  const diff = Date.now() - date.getTime()
  const minutes = Math.round(diff / 60_000)
  if (Math.abs(minutes) < 60) return RELATIVE.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return RELATIVE.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return RELATIVE.format(-days, 'day')
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function PipelinesTable({
  initialPipelines,
  boardBasePath,
}: PipelinesTableProps) {
  const router = useRouter()
  const [pipelines, setPipelines] = useState(initialPipelines)
  // Re-seed local state whenever the server payload changes (router
  // .refresh() after create/duplicate/reorder). Signature-diff so we
  // don't stomp mid-drag optimistic edits with an identical payload.
  const lastSignature = useRef(signaturePipelines(initialPipelines))
  const incomingSignature = signaturePipelines(initialPipelines)
  if (incomingSignature !== lastSignature.current) {
    lastSignature.current = incomingSignature
    setPipelines(initialPipelines)
  }
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  // Row-level dialogs, keyed by the pipeline they target.
  const [manageStagesFor, setManageStagesFor] = useState<PipelineListRow | null>(
    null,
  )
  const [renameFor, setRenameFor] = useState<PipelineListRow | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteFor, setDeleteFor] = useState<PipelineListRow | null>(null)
  const [pending, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return pipelines
    return pipelines.filter((p) => p.name.toLowerCase().includes(q))
  }, [pipelines, query])

  // Search filters the *view* but the drag list uses the underlying
  // pipelines array — reorder is a global concern, not a filtered one.
  const dragDisabled = query.trim().length > 0

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = pipelines.findIndex((p) => p.id === active.id)
    const newIndex = pipelines.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const next = pipelines.slice()
    const [moved] = next.splice(oldIndex, 1)
    if (!moved) return
    next.splice(newIndex, 0, moved)
    // Re-stamp orderIndex locally so the UI numbering stays honest
    // before the server round-trip.
    setPipelines(next.map((p, i) => ({ ...p, orderIndex: i })))

    startTransition(async () => {
      const res = await reorderPipelinesAction({
        pipelineIds: next.map((p) => p.id),
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not reorder')
        setPipelines(initialPipelines)
        return
      }
      router.refresh()
    })
  }

  function submitRename(e: React.FormEvent) {
    e.preventDefault()
    if (!renameFor) return
    const name = renameValue.trim()
    if (!name) return
    startTransition(async () => {
      const res = await renamePipelineAction({
        pipelineId: renameFor.id,
        name,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not rename pipeline')
        return
      }
      setPipelines((prev) =>
        prev.map((p) => (p.id === renameFor.id ? { ...p, name } : p)),
      )
      toast.success('Pipeline renamed')
      setRenameFor(null)
      router.refresh()
    })
  }

  function confirmDelete() {
    if (!deleteFor) return
    startTransition(async () => {
      const res = await deletePipelineAction(deleteFor.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete pipeline')
        return
      }
      setPipelines((prev) => prev.filter((p) => p.id !== deleteFor.id))
      toast.success('Pipeline deleted')
      setDeleteFor(null)
      router.refresh()
    })
  }

  function duplicate(pipeline: PipelineListRow) {
    const proposed = `${pipeline.name} copy`
    startTransition(async () => {
      const res = await duplicatePipelineAction({
        sourcePipelineId: pipeline.id,
        name: proposed,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not duplicate pipeline')
        return
      }
      toast.success(`Duplicated as “${res.data.name}”`)
      router.refresh()
    })
  }

  function copyLink(pipeline: PipelineListRow) {
    // Absolute so the copied link works when pasted into email / chat.
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}${boardBasePath}?pipeline=${pipeline.id}`
        : `${boardBasePath}?pipeline=${pipeline.id}`
    void navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Link copied'))
      .catch(() => toast.error('Could not copy link'))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            aria-hidden
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pipelines"
            className="pl-9"
            aria-label="Search pipelines"
          />
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create pipeline
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={KanbanSquare}
          tone="neutral"
          title={query ? 'No pipelines match your search' : 'No pipelines yet'}
          description={
            query
              ? 'Try a different search term.'
              : 'Create your first pipeline to start tracking deals.'
          }
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <DndContext
            id="pipelines-reorder"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" aria-label="Reorder" />
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Pipeline name</TableHead>
                  <TableHead className="w-32 text-right">
                    Total stages
                  </TableHead>
                  <TableHead className="w-40">Updated</TableHead>
                  <TableHead className="w-16 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SortableContext
                  items={visible.map((p) => p.id)}
                  strategy={verticalListSortingStrategy}
                  disabled={dragDisabled}
                >
                  {visible.map((pipeline, index) => (
                    <SortableRow
                      key={pipeline.id}
                      pipeline={pipeline}
                      index={index}
                      boardBasePath={boardBasePath}
                      dragDisabled={dragDisabled}
                      onManageStages={() => setManageStagesFor(pipeline)}
                      onRename={() => {
                        setRenameValue(pipeline.name)
                        setRenameFor(pipeline)
                      }}
                      onDuplicate={() => duplicate(pipeline)}
                      onCopyLink={() => copyLink(pipeline)}
                      onDelete={() => setDeleteFor(pipeline)}
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
        </div>
      )}

      <CreatePipelineDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => router.refresh()}
      />

      <ManageStagesDialog
        open={manageStagesFor !== null}
        pipelineId={manageStagesFor?.id ?? null}
        pipelineName={manageStagesFor?.name ?? 'Pipeline'}
        initialNotifyEmail={manageStagesFor?.notifyEmail ?? null}
        initialNotifyPhone={manageStagesFor?.notifyPhone ?? null}
        onOpenChange={(open) => !open && setManageStagesFor(null)}
        onChanged={() => router.refresh()}
      />

      <Dialog open={renameFor !== null} onOpenChange={(o) => !o && setRenameFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={submitRename}>
            <DialogHeader>
              <DialogTitle>Rename pipeline</DialogTitle>
              <DialogDescription>
                Give this pipeline a clearer name.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5 py-4">
              <Label htmlFor="pipeline-rename-input">Name</Label>
              <Input
                id="pipeline-rename-input"
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
                onClick={() => setRenameFor(null)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteFor !== null}
        onOpenChange={(o) => !o && setDeleteFor(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteFor?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              A pipeline can only be deleted once it holds no open deals.
              Move or delete its deals first — this can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface SortableRowProps {
  pipeline: PipelineListRow
  index: number
  boardBasePath: string
  dragDisabled: boolean
  onManageStages: () => void
  onRename: () => void
  onDuplicate: () => void
  onCopyLink: () => void
  onDelete: () => void
}

function SortableRow({
  pipeline,
  index,
  boardBasePath,
  dragDisabled,
  onManageStages,
  onRename,
  onDuplicate,
  onCopyLink,
  onDelete,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pipeline.id, disabled: dragDisabled })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  const boardHref = `${boardBasePath}?pipeline=${pipeline.id}`

  return (
    <TableRow ref={setNodeRef} style={style} data-state={isDragging ? 'selected' : undefined}>
      <TableCell className="w-10">
        <button
          type="button"
          className={cn(
            'flex size-6 items-center justify-center rounded text-muted-foreground transition-colors',
            dragDisabled
              ? 'cursor-not-allowed opacity-30'
              : 'cursor-grab hover:text-foreground active:cursor-grabbing',
          )}
          aria-label={`Reorder ${pipeline.name}`}
          disabled={dragDisabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      </TableCell>
      <TableCell className="w-12 text-muted-foreground">{index + 1}</TableCell>
      <TableCell>
        <Link
          href={boardHref}
          className="group inline-flex items-center gap-2 font-medium text-foreground hover:text-primary"
        >
          {pipeline.name}
          <ExternalLink className="size-3 opacity-0 transition-opacity group-hover:opacity-70" />
        </Link>
      </TableCell>
      <TableCell className="w-32 text-right tabular-nums">
        {pipeline.stageCount}
      </TableCell>
      <TableCell className="w-40 text-sm text-muted-foreground">
        {formatUpdated(pipeline.updatedAt)}
      </TableCell>
      <TableCell className="w-16 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${pipeline.name}`}
            render={
              <Button variant="ghost" size="icon" className="size-8">
                <MoreVertical className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onManageStages}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRename}>
              <ListChecks className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="size-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopyLink}>
              <Link2 className="size-4" />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
