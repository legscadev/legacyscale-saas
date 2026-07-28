'use client'

// Edit-opportunity dialog — mirrors HighLevel's "Edit "OppName""
// layout: header with the deal name in quotes + short description,
// a narrow left rail with section navigation (only "Opportunity
// details" is live for now; the rest are placeholders for future
// tabs), and a right pane split into Contact details / Opportunity
// details sections. Field edits go through updateOpportunityAction;
// a stage change routes through moveOpportunityAction (so WON/LOST
// status + close timestamps stay correct).

import { useEffect, useMemo, useState, useTransition } from 'react'
import {
  Bookmark,
  Calendar,
  CheckSquare,
  CreditCard,
  Link2,
  Loader2,
  Settings2,
  StickyNote,
  Trash2,
  UserPlus,
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
import { Textarea } from '@/components/ui/textarea'
import { toCalendarDateInput } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  deleteOpportunityAction,
  fetchOpportunityAction,
  moveOpportunityAction,
  updateOpportunityAction,
} from '@/app/(admin)/admin/crm/opportunities/actions'
import type { CrmTeamMember } from '@/app/(admin)/admin/crm/opportunities/actions'
import type {
  PipelineStage,
  PipelineSummary,
} from '@/lib/services/crm-pipeline-service'

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface EditOpportunityDialogProps {
  opportunityId: string | null
  pipelines: PipelineSummary[]
  /** The pipeline the currently loaded deal belongs to — used to
   *  display the pipeline name read-only in the header. */
  currentPipelineId: string | null
  stages: PipelineStage[]
  members: CrmTeamMember[]
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

interface FormState {
  /** The opportunity this form was loaded for — lets us derive the
   *  loading state without a synchronous setState in the effect. */
  id: string
  name: string
  value: string
  companyName: string
  contactName: string
  contactEmail: string
  contactPhone: string
  probability: string
  expectedCloseDate: string
  assignedCloserId: string
  notes: string
  status: 'OPEN' | 'WON' | 'LOST'
  stageId: string
}

export function EditOpportunityDialog({
  opportunityId,
  pipelines,
  currentPipelineId,
  stages,
  members,
  onOpenChange,
  onChanged,
}: EditOpportunityDialogProps) {
  const [pending, startTransition] = useTransition()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [form, setForm] = useState<FormState | null>(null)
  const [initialStageId, setInitialStageId] = useState<string>('')

  const loading = !!opportunityId && form?.id !== opportunityId

  useEffect(() => {
    if (!opportunityId) return
    let cancelled = false
    fetchOpportunityAction(opportunityId).then((res) => {
      if (cancelled) return
      if (!res.ok) {
        toast.error(res.error ?? 'Could not load opportunity')
        onOpenChange(false)
        return
      }
      const d = res.data
      setInitialStageId(d.stageId)
      setConfirmingDelete(false)
      setForm({
        id: d.id,
        name: d.name,
        value: d.value === null ? '' : String(d.value),
        companyName: d.companyName ?? '',
        contactName: d.contactName ?? '',
        contactEmail: d.contactEmail ?? '',
        contactPhone: d.contactPhone ?? '',
        probability: d.probability === null ? '' : String(d.probability),
        expectedCloseDate: d.expectedCloseDate
          ? toCalendarDateInput(d.expectedCloseDate)
          : '',
        assignedCloserId: d.assignedCloser?.id ?? '',
        notes: d.notes ?? '',
        status: d.status,
        stageId: d.stageId,
      })
    })
    return () => {
      cancelled = true
    }
  }, [opportunityId, onOpenChange])

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: val } : prev))
  }

  const currentPipeline = useMemo(
    () => pipelines.find((p) => p.id === currentPipelineId) ?? null,
    [pipelines, currentPipelineId],
  )

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form || !opportunityId) return
    if (!form.name.trim()) {
      toast.error('Opportunity name is required')
      return
    }
    const parsedValue = form.value.trim() === '' ? null : Number(form.value)
    if (parsedValue !== null && Number.isNaN(parsedValue)) {
      toast.error('Value must be a number')
      return
    }
    const parsedProb =
      form.probability.trim() === '' ? null : Number(form.probability)
    if (
      parsedProb !== null &&
      (Number.isNaN(parsedProb) || parsedProb < 0 || parsedProb > 100)
    ) {
      toast.error('Probability must be 0–100')
      return
    }

    startTransition(async () => {
      const res = await updateOpportunityAction(opportunityId, {
        name: form.name.trim(),
        value: parsedValue,
        companyName: form.companyName.trim() || null,
        contactName: form.contactName.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        probability: parsedProb,
        expectedCloseDate: form.expectedCloseDate || undefined,
        assignedCloserId: form.assignedCloserId || null,
        notes: form.notes.trim() || null,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not save opportunity')
        return
      }
      // Stage change routes through the move path so WON/LOST + close
      // timestamps update.
      if (form.stageId && form.stageId !== initialStageId) {
        const moveRes = await moveOpportunityAction({
          opportunityId,
          stageId: form.stageId,
        })
        if (!moveRes.ok) {
          toast.error(moveRes.error ?? 'Saved, but could not move stage')
          onChanged()
          onOpenChange(false)
          return
        }
      }
      toast.success('Opportunity updated')
      onChanged()
      onOpenChange(false)
    })
  }

  function handleDelete() {
    if (!opportunityId) return
    startTransition(async () => {
      const res = await deleteOpportunityAction(opportunityId)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete opportunity')
        return
      }
      toast.success('Opportunity deleted')
      onChanged()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={!!opportunityId} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Edit {form?.name ? `“${form.name}”` : 'opportunity'}
          </DialogTitle>
          <DialogDescription>
            Add and edit opportunity details, tasks, notes and
            appointments.
          </DialogDescription>
        </DialogHeader>

        {loading || !form ? (
          <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <form onSubmit={handleSave}>
            <div className="mt-4 flex flex-col gap-6 sm:flex-row">
              {/* Left rail — section navigation. Only "Opportunity
                  details" is live; the rest are placeholders for
                  tabs that ship in later phases. */}
              <aside className="flex flex-row items-stretch gap-1 overflow-x-auto border-b pb-3 sm:w-56 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
                <NavItem active label="Opportunity details" />
                <NavItem
                  disabled
                  icon={Calendar}
                  label="Book or update appointment"
                />
                <NavItem disabled icon={CheckSquare} label="Tasks" />
                <NavItem disabled icon={StickyNote} label="Notes" />
                <NavItem disabled icon={CreditCard} label="Payments" />
                <NavItem
                  disabled
                  icon={Link2}
                  label="Associated objects"
                />
                <button
                  type="button"
                  disabled
                  title="Custom fields — coming soon"
                  className="mt-auto flex items-center gap-1.5 rounded-md px-3 py-2 text-left text-xs text-muted-foreground opacity-60"
                >
                  <Settings2 className="size-3" aria-hidden />
                  Manage fields
                </button>
              </aside>

              {/* Right pane */}
              <div className="min-w-0 flex-1 space-y-6">
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">
                      Contact details
                    </h3>
                    <span
                      title="Add contact"
                      className="text-muted-foreground"
                    >
                      <UserPlus className="size-3.5" aria-hidden />
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      id="edit-contact"
                      label="Primary contact name"
                      required
                    >
                      <Input
                        id="edit-contact"
                        value={form.contactName}
                        onChange={(e) => set('contactName', e.target.value)}
                        placeholder="Select contact"
                      />
                    </Field>
                    <Field id="edit-email" label="Primary email">
                      <Input
                        id="edit-email"
                        type="email"
                        value={form.contactEmail}
                        onChange={(e) => set('contactEmail', e.target.value)}
                        placeholder="Enter email"
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="edit-phone" label="Primary phone">
                      <Input
                        id="edit-phone"
                        value={form.contactPhone}
                        onChange={(e) => set('contactPhone', e.target.value)}
                        placeholder="Enter phone"
                      />
                    </Field>
                    <Field id="edit-company" label="Company">
                      <Input
                        id="edit-company"
                        value={form.companyName}
                        onChange={(e) => set('companyName', e.target.value)}
                        placeholder="Company name"
                      />
                    </Field>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Opportunity details
                  </h3>
                  <Field id="edit-name" label="Opportunity name" required>
                    <Input
                      id="edit-name"
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      required
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="edit-pipeline" label="Pipeline">
                      {/* Moving a deal to another pipeline isn't wired
                          yet — show the current pipeline read-only so
                          the layout still matches HL. */}
                      <select
                        id="edit-pipeline"
                        value={currentPipeline?.id ?? ''}
                        disabled
                        className={SELECT_CLASS}
                      >
                        {currentPipeline ? (
                          <option value={currentPipeline.id}>
                            {currentPipeline.name}
                          </option>
                        ) : (
                          <option value="">—</option>
                        )}
                      </select>
                    </Field>
                    <Field id="edit-stage" label="Stage">
                      <select
                        id="edit-stage"
                        value={form.stageId}
                        onChange={(e) => set('stageId', e.target.value)}
                        className={SELECT_CLASS}
                      >
                        {stages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="edit-status" label="Status">
                      <select
                        id="edit-status"
                        value={form.status}
                        disabled
                        title="Status flips automatically when the deal lands in a Won or Lost stage."
                        className={SELECT_CLASS}
                      >
                        <option value="OPEN">Open</option>
                        <option value="WON">Won</option>
                        <option value="LOST">Lost</option>
                      </select>
                    </Field>
                    <Field id="edit-value" label="Value">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          $
                        </span>
                        <Input
                          id="edit-value"
                          type="number"
                          min={0}
                          step="any"
                          value={form.value}
                          onChange={(e) => set('value', e.target.value)}
                          placeholder="0"
                          className={cn('no-spinner pl-6')}
                        />
                      </div>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="edit-prob" label="Probability (%)">
                      <Input
                        id="edit-prob"
                        type="number"
                        min={0}
                        max={100}
                        value={form.probability}
                        onChange={(e) => set('probability', e.target.value)}
                        className="no-spinner"
                      />
                    </Field>
                    <Field id="edit-close" label="Expected close">
                      <Input
                        id="edit-close"
                        type="date"
                        value={form.expectedCloseDate}
                        onChange={(e) =>
                          set('expectedCloseDate', e.target.value)
                        }
                      />
                    </Field>
                  </div>
                  <Field id="edit-closer" label="Assigned closer">
                    <select
                      id="edit-closer"
                      value={form.assignedCloserId}
                      onChange={(e) => set('assignedCloserId', e.target.value)}
                      className={SELECT_CLASS}
                    >
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name ?? m.email}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="edit-notes" label="Notes">
                    <Textarea
                      id="edit-notes"
                      value={form.notes}
                      onChange={(e) => set('notes', e.target.value)}
                      rows={3}
                      placeholder="Context, next steps…"
                    />
                  </Field>
                </section>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Left: delete affordance with inline confirm. */}
              {confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Delete this opportunity?
                  </span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={pending}
                  >
                    Confirm
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={pending}
                  aria-label="Delete opportunity"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Saving…' : 'Update'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Field({
  id,
  label,
  required,
  children,
}: {
  id: string
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
        {required ? (
          <span className="ml-0.5 text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </Label>
      {children}
    </div>
  )
}

function NavItem({
  active,
  disabled,
  icon: Icon,
  label,
}: {
  active?: boolean
  disabled?: boolean
  icon?: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? 'Coming soon' : undefined}
      className={cn(
        'inline-flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
        active
          ? 'bg-primary/10 font-medium text-primary'
          : disabled
            ? 'text-muted-foreground opacity-60'
            : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
      )}
    >
      {Icon ? <Icon className="size-3.5" /> : <Bookmark className="size-3.5 opacity-0" />}
      <span className="truncate">{label}</span>
    </button>
  )
}
