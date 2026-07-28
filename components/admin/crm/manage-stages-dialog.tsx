'use client'

// Manage-stages editor for the current pipeline. Header shows the
// pipeline name with an inline rename pencil (HighLevel-style). Body
// lists stages with a search box, per-row inline editing (colour,
// name, probability, Won/Lost), reorder via up/down arrows, and
// per-stage delete (guarded — a stage holding deals or the last
// stage can't be removed). Every edit is its own action call, applied
// optimistically and reconciled by the board on close.

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import {
  addStageAction,
  deleteStageAction,
  fetchPipelineStagesAction,
  renamePipelineAction,
  reorderStagesAction,
  updateStageAction,
  type StageWithCount,
} from '@/app/(admin)/admin/crm/opportunities/actions'

interface ManageStagesDialogProps {
  open: boolean
  pipelineId: string | null
  pipelineName: string
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

export function ManageStagesDialog({
  open,
  pipelineId,
  pipelineName,
  onOpenChange,
  onChanged,
}: ManageStagesDialogProps) {
  const [stages, setStages] = useState<StageWithCount[]>([])
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [query, setQuery] = useState('')
  const [, startOp] = useTransition()

  // Inline pipeline rename — persists on submit / blur.
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(pipelineName)
  const [displayName, setDisplayName] = useState(pipelineName)

  const loading = open && !!pipelineId && loadedFor !== pipelineId

  useEffect(() => {
    if (!open || !pipelineId) return
    let cancelled = false
    setDisplayName(pipelineName)
    setNameDraft(pipelineName)
    setRenaming(false)
    setQuery('')
    fetchPipelineStagesAction(pipelineId).then((res) => {
      if (cancelled) return
      if (!res.ok) {
        toast.error(res.error ?? 'Could not load stages')
        return
      }
      setStages(res.data)
      setLoadedFor(pipelineId)
    })
    return () => {
      cancelled = true
    }
  }, [open, pipelineId, pipelineName])

  function patchLocal(id: string, patch: Partial<StageWithCount>) {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  /** Persist a single-field edit; roll back the optimistic patch on
   *  failure. */
  function saveStage(
    id: string,
    patch: Partial<
      Pick<StageWithCount, 'name' | 'color' | 'probability' | 'isWon' | 'isLost'>
    >,
    prev: Partial<StageWithCount>,
  ) {
    startOp(async () => {
      const res = await updateStageAction({ stageId: id, ...patch })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not save stage')
        patchLocal(id, prev)
        return
      }
      onChanged()
    })
  }

  function toggleOutcome(stage: StageWithCount, outcome: 'won' | 'lost') {
    const nextWon = outcome === 'won' ? !stage.isWon : false
    const nextLost = outcome === 'lost' ? !stage.isLost : false
    const patch = { isWon: nextWon, isLost: nextLost }
    patchLocal(stage.id, patch)
    saveStage(stage.id, patch, { isWon: stage.isWon, isLost: stage.isLost })
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= stages.length) return
    const next = stages.slice()
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    setStages(next)
    startOp(async () => {
      const res = await reorderStagesAction({
        pipelineId,
        stageIds: next.map((s) => s.id),
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not reorder')
        return
      }
      onChanged()
    })
  }

  function addStage() {
    const name = newName.trim()
    if (!name || !pipelineId) return
    startOp(async () => {
      const res = await addStageAction({ pipelineId, name })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not add stage')
        return
      }
      setStages((prev) => [...prev, { ...res.data, dealCount: 0 }])
      setNewName('')
      onChanged()
    })
  }

  function removeStage(stage: StageWithCount) {
    startOp(async () => {
      const res = await deleteStageAction(stage.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete stage')
        return
      }
      setStages((prev) => prev.filter((s) => s.id !== stage.id))
      onChanged()
    })
  }

  function commitRename() {
    const val = nameDraft.trim()
    if (!pipelineId || !val || val === displayName) {
      setRenaming(false)
      setNameDraft(displayName)
      return
    }
    startOp(async () => {
      const res = await renamePipelineAction({
        pipelineId,
        name: val,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not rename pipeline')
        setNameDraft(displayName)
        return
      }
      toast.success('Pipeline renamed')
      setDisplayName(val)
      setRenaming(false)
      onChanged()
    })
  }

  const filteredStages = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return stages
    return stages.filter((s) => s.name.toLowerCase().includes(q))
  }, [stages, query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {renaming ? (
              <div className="flex flex-1 items-center gap-1">
                <Input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitRename()
                    } else if (e.key === 'Escape') {
                      setRenaming(false)
                      setNameDraft(displayName)
                    }
                  }}
                  className="h-8 text-lg font-semibold"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={commitRename}
                  aria-label="Save name"
                >
                  <Check className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onClick={() => {
                    setRenaming(false)
                    setNameDraft(displayName)
                  }}
                  aria-label="Cancel rename"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <>
                <DialogTitle className="flex-1 text-left">
                  {displayName}
                </DialogTitle>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => setRenaming(true)}
                  aria-label="Rename pipeline"
                >
                  <Pencil className="size-4" />
                </Button>
              </>
            )}
          </div>
          <DialogDescription>
            Rename the pipeline, adjust stage colours, probabilities and
            Won/Lost outcomes. Reorder with the arrows. A stage that
            still holds deals can’t be deleted.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            {/* Search + Add stage row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  aria-hidden
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search stages"
                  className="pl-9"
                  aria-label="Search stages"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addStage()
                    }
                  }}
                  placeholder="New stage name…"
                  className="h-9 sm:w-56"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={addStage}
                  disabled={!newName.trim()}
                >
                  <Plus className="size-4" />
                  Add stage
                </Button>
              </div>
            </div>

            <div className="max-h-[55vh] space-y-2 overflow-y-auto py-2">
              {/* Header row */}
              <div className="grid grid-cols-[auto_1fr_5rem_auto_3rem_auto] items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span className="w-14">Order</span>
                <span>Name</span>
                <span>Prob %</span>
                <span>Outcome</span>
                <span className="text-center">Deals</span>
                <span />
              </div>

              {filteredStages.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  {query
                    ? 'No stages match your search.'
                    : 'No stages yet — add one above.'}
                </p>
              ) : (
                filteredStages.map((stage) => {
                  const i = stages.indexOf(stage)
                  return (
                    <div
                      key={stage.id}
                      className="grid grid-cols-[auto_1fr_5rem_auto_3rem_auto] items-center gap-2 rounded-lg border bg-card px-2 py-1.5"
                    >
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={i === 0 || !!query}
                          onClick={() => move(i, -1)}
                          aria-label="Move up"
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={i === stages.length - 1 || !!query}
                          onClick={() => move(i, 1)}
                          aria-label="Move down"
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                      </div>

                      <div className="flex min-w-0 items-center gap-2">
                        <input
                          type="color"
                          value={stage.color}
                          onChange={(e) => {
                            const prev = stage.color
                            patchLocal(stage.id, { color: e.target.value })
                            saveStage(
                              stage.id,
                              { color: e.target.value },
                              { color: prev },
                            )
                          }}
                          className="size-6 shrink-0 cursor-pointer rounded border bg-transparent"
                          aria-label="Stage colour"
                        />
                        <Input
                          defaultValue={stage.name}
                          key={`name-${stage.id}-${stage.name}`}
                          onBlur={(e) => {
                            const val = e.target.value.trim()
                            if (val && val !== stage.name) {
                              saveStage(
                                stage.id,
                                { name: val },
                                { name: stage.name },
                              )
                              patchLocal(stage.id, { name: val })
                            }
                          }}
                          className="h-8"
                        />
                      </div>

                      <Input
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={stage.probability ?? ''}
                        key={`prob-${stage.id}-${stage.probability}`}
                        onBlur={(e) => {
                          const raw = e.target.value.trim()
                          const val = raw === '' ? null : Number(raw)
                          if (val !== stage.probability) {
                            saveStage(
                              stage.id,
                              { probability: val },
                              { probability: stage.probability },
                            )
                            patchLocal(stage.id, { probability: val })
                          }
                        }}
                        className="no-spinner h-8"
                      />

                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={stage.isWon ? 'default' : 'outline'}
                          onClick={() => toggleOutcome(stage, 'won')}
                          className={cn(
                            'h-7 px-2 text-xs',
                            stage.isWon &&
                              'bg-emerald-600 hover:bg-emerald-700',
                          )}
                        >
                          Won
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={stage.isLost ? 'default' : 'outline'}
                          onClick={() => toggleOutcome(stage, 'lost')}
                          className={cn(
                            'h-7 px-2 text-xs',
                            stage.isLost &&
                              'bg-rose-600 hover:bg-rose-700',
                          )}
                        >
                          Lost
                        </Button>
                      </div>

                      <span className="text-center text-xs tabular-nums text-muted-foreground">
                        {stage.dealCount}
                      </span>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={stage.dealCount > 0 || stages.length <= 1}
                        onClick={() => removeStage(stage)}
                        aria-label="Delete stage"
                        title={
                          stage.dealCount > 0
                            ? 'Move its deals first'
                            : stages.length <= 1
                              ? 'A pipeline needs at least one stage'
                              : 'Delete stage'
                        }
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
