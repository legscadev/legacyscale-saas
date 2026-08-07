'use client'

// Create-pipeline dialog — mirrors HighLevel's "Create pipeline" layout
// verbatim: pipeline name, then a "Set pipeline display colors" pill
// selector with three preview modes, then an inline "Pipeline stages
// (N)" editor where each row has the stage-name input, a
// "Show in reports" icon toggle group, and a delete affordance.
//
// The displayMode + per-stage showInReports flags are UI-state only
// for now (no schema field yet). They're captured on submit and
// ignored server-side; a later phase adds persistence.

import { useState, useTransition } from 'react'
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
  Bell,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import { createPipelineAction } from '@/app/(admin)/admin/crm/opportunities/actions'
import type { PipelineSummary } from '@/lib/services/crm-pipeline-service'

import { NotifyEmailInput } from './notify-email-input'

const DEFAULT_STAGE_NAMES = [
  'New Lead',
  'Contacted',
  'Qualified',
  'Appointment Scheduled',
  'Presentation',
  'Proposal Sent',
  'Negotiation',
  'Won',
  'Lost',
]

type DisplayMode = 'default' | 'dot' | 'background'

interface StageDraft {
  key: string
  name: string
  showInReports: boolean
}

interface CreatePipelineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (pipeline: PipelineSummary) => void
}

let nextKey = 0
const makeStage = (name = ''): StageDraft => ({
  key: `stage-${++nextKey}`,
  name,
  showInReports: true,
})

export function CreatePipelineDialog({
  open,
  onOpenChange,
  onCreated,
}: CreatePipelineDialogProps) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [notifyEmail, setNotifyEmail] = useState('')
  const [notifyPhone, setNotifyPhone] = useState('')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('default')
  const [stages, setStages] = useState<StageDraft[]>(() =>
    DEFAULT_STAGE_NAMES.map((n) => makeStage(n)),
  )
  const [touched, setTouched] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setStages((prev) => {
      const oldIndex = prev.findIndex((s) => s.key === active.id)
      const newIndex = prev.findIndex((s) => s.key === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      const next = prev.slice()
      const [moved] = next.splice(oldIndex, 1)
      if (!moved) return prev
      next.splice(newIndex, 0, moved)
      return next
    })
  }

  function reset() {
    setName('')
    setNotifyEmail('')
    setNotifyPhone('')
    setDisplayMode('default')
    setStages(DEFAULT_STAGE_NAMES.map((n) => makeStage(n)))
    setTouched(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function updateStage(key: string, patch: Partial<StageDraft>) {
    setStages((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    )
  }

  function removeStage(key: string) {
    setStages((prev) => prev.filter((s) => s.key !== key))
  }

  function addStage() {
    setStages((prev) => [...prev, makeStage()])
  }

  const validStageCount = stages.filter((s) => s.name.trim()).length
  const nameEmpty = name.trim() === ''
  const showNameError = touched && nameEmpty
  const canSubmit = !nameEmpty && validStageCount > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (nameEmpty) {
      toast.error('Pipeline name is required')
      return
    }
    const stageNames = stages
      .map((s) => s.name.trim())
      .filter((s) => s.length > 0)
    if (stageNames.length === 0) {
      toast.error('Add at least one stage')
      return
    }

    startTransition(async () => {
      const res = await createPipelineAction({
        name: name.trim(),
        stageNames,
        notifyEmail: notifyEmail.trim() || undefined,
        notifyPhone: notifyPhone.trim() || undefined,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not create pipeline')
        return
      }
      toast.success('Pipeline created')
      onCreated(res.data)
      handleOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="border-b p-4">
            <DialogTitle>Create pipeline</DialogTitle>
            <DialogDescription className="sr-only">
              Create a new pipeline with its own stages.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            {/* Pipeline name */}
            <div className="space-y-1.5">
              <Label
                htmlFor="pipeline-name"
                className="text-xs font-medium"
              >
                Pipeline name
                <span className="ml-0.5 text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="pipeline-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="Marketing pipeline"
                autoFocus
                aria-invalid={showNameError || undefined}
                className={cn(showNameError && 'border-destructive')}
              />
              {showNameError ? (
                <p className="text-xs text-destructive">
                  Pipeline name is required
                </p>
              ) : null}
            </div>

            {/* Owner alert (SMS) */}
            <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">Owner alert (SMS)</h3>
              </div>
              <p className="-mt-2 text-[11px] text-muted-foreground">
                Text this teammate the moment a new lead lands here. Optional.
              </p>
              <div className="space-y-1.5">
                <Label
                  htmlFor="pipeline-notify-phone"
                  className="text-xs font-medium"
                >
                  Owner mobile
                </Label>
                <NotifyEmailInput
                  id="pipeline-notify-phone"
                  pickFills="phone"
                  value={notifyPhone}
                  onChange={setNotifyPhone}
                  placeholder="Search a teammate or type a mobile number"
                />
              </div>
            </section>

            {/* Display-mode picker */}
            <section className="space-y-2">
              <div>
                <h3 className="text-sm font-semibold">
                  Set pipeline display colors
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Choose how stage colors appear across your pipeline
                  views.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <DisplayModeCard
                  active={displayMode === 'default'}
                  onSelect={() => setDisplayMode('default')}
                  label="Default (no color)"
                  preview={
                    <span className="inline-flex flex-col items-start gap-1">
                      <span className="text-xs">Stage name</span>
                      <span className="h-0.5 w-16 rounded-full bg-muted-foreground/40" />
                    </span>
                  }
                />
                <DisplayModeCard
                  active={displayMode === 'dot'}
                  onSelect={() => setDisplayMode('dot')}
                  label="Colored dot"
                  preview={
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-sky-500"
                      />
                      <span className="text-xs">Stage name</span>
                    </span>
                  }
                />
                <DisplayModeCard
                  active={displayMode === 'background'}
                  onSelect={() => setDisplayMode('background')}
                  label="Background color"
                  preview={
                    <span className="inline-flex items-center rounded-full bg-sky-500/20 px-2 py-0.5 text-xs text-sky-500">
                      Stage name
                    </span>
                  }
                />
              </div>
            </section>

            {/* Stages */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Pipeline stages ({validStageCount})
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addStage}
                  className="text-primary hover:text-primary"
                >
                  <Plus className="size-4" />
                  Add stage
                </Button>
              </div>

              {/* Column labels — leading column left blank for the
                  drag handle so the header aligns with the rows. */}
              <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span className="w-6" aria-hidden />
                <span>Stage name</span>
                <span
                  className="text-right"
                  title="Whether the stage appears on the pipeline reports view"
                >
                  Show in reports
                </span>
                <span className="w-8" aria-hidden />
              </div>

              <div className="space-y-1.5">
                {stages.length === 0 ? (
                  <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                    No stages yet — click “Add stage” to start.
                  </p>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={stages.map((s) => s.key)}
                      strategy={verticalListSortingStrategy}
                    >
                      {stages.map((stage) => (
                        <StageRow
                          key={stage.key}
                          id={stage.key}
                          name={stage.name}
                          showInReports={stage.showInReports}
                          canDelete={stages.length > 1}
                          onChange={(name) => updateStage(stage.key, { name })}
                          onToggleReports={() =>
                            updateStage(stage.key, {
                              showInReports: !stage.showInReports,
                            })
                          }
                          onDelete={() => removeStage(stage.key)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </section>
          </div>

          <div className="flex justify-end gap-2 border-t p-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !canSubmit}>
              {pending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DisplayModeCardProps {
  active: boolean
  onSelect: () => void
  label: string
  preview: React.ReactNode
}

function DisplayModeCard({
  active,
  onSelect,
  label,
  preview,
}: DisplayModeCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border-2 bg-card p-3 text-center transition-colors',
        active
          ? 'border-primary'
          : 'border-input hover:border-muted-foreground/40',
      )}
    >
      <span className="flex h-6 items-center">{preview}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </button>
  )
}

interface StageRowProps {
  id: string
  name: string
  showInReports: boolean
  canDelete: boolean
  onChange: (name: string) => void
  onToggleReports: () => void
  onDelete: () => void
}

function StageRow({
  id,
  name,
  showInReports,
  canDelete,
  onChange,
  onToggleReports,
  onDelete,
}: StageRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  const lower = name.trim().toLowerCase()
  const isWon = lower === 'won'
  const isLost = lower === 'lost'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3"
    >
      <button
        type="button"
        aria-label="Reorder stage"
        {...attributes}
        {...listeners}
        className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <Input
        value={name}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Stage name"
        className={cn(
          isWon && 'border-emerald-300 focus-visible:border-emerald-400',
          isLost && 'border-rose-300 focus-visible:border-rose-400',
        )}
      />
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleReports}
          aria-pressed={showInReports}
          aria-label={showInReports ? 'Shown in reports' : 'Hidden from reports'}
          title={
            showInReports
              ? 'Shown in reports — click to hide'
              : 'Hidden from reports — click to show'
          }
          className={cn(
            'size-8',
            showInReports ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {showInReports ? (
            <Eye className="size-4" />
          ) : (
            <EyeOff className="size-4" />
          )}
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={!canDelete}
        aria-label="Remove stage"
        className="size-8 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}
