'use client'

// Edit-opportunity dialog — mirrors HighLevel's "Edit "OppName""
// layout: header with the deal name in quotes + short description,
// a narrow left rail with section navigation (only "Opportunity
// details" is live for now; the rest are placeholders for future
// tabs), and a right pane split into Contact details / Opportunity
// details sections. Field edits go through updateOpportunityAction;
// a stage change routes through moveOpportunityAction (so WON/LOST
// status + close timestamps stay correct).

import { useEffect, useState, useTransition } from 'react'
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
  fetchPipelineStagesAction,
  moveOpportunityAction,
  updateOpportunityAction,
} from '@/app/(admin)/admin/crm/opportunities/actions'
import type { CrmTeamMember } from '@/app/(admin)/admin/crm/opportunities/actions'
import type { LeadListItem } from '@/lib/services/crm-lead-service'
import type {
  PipelineStage,
  PipelineSummary,
} from '@/lib/services/crm-pipeline-service'

import { ContactPicker, type InlineContactDraft } from './contact-picker'
import { OpportunityNotesPanel } from './opportunity-notes-panel'
import { OpportunityTasksPanel } from './opportunity-tasks-panel'

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
  probability: string
  expectedCloseDate: string
  assignedCloserId: string
  notes: string
  source: string
  status: 'OPEN' | 'WON' | 'LOST'
  pipelineId: string
  stageId: string
  /** Currently linked contact (from opportunity.contact). Null while
   *  the picker is empty; changing it stages a new contactId to send. */
  contact: LeadListItem | null
  /** Draft from the picker's inline "Add new contact" form. On save,
   *  the service find-or-creates by email and links the id. */
  contactDraft: InlineContactDraft | null
}

/** Which section of the edit dialog is showing. Tasks + Notes are
 *  live tabs backed by their own tables; Payments/Appointments/
 *  Associated objects remain placeholders until those subsystems land. */
type EditSection = 'details' | 'tasks' | 'notes'

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
  const [initialPipelineId, setInitialPipelineId] = useState<string>('')
  const [initialStatus, setInitialStatus] =
    useState<'OPEN' | 'WON' | 'LOST'>('OPEN')
  const [section, setSection] = useState<EditSection>('details')
  /** Stages for the pipeline currently picked in the form — starts as
   *  the loaded deal's pipeline stages, swapped when the user picks a
   *  different pipeline from the dropdown. */
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(stages)
  const [loadingStages, setLoadingStages] = useState(false)

  const loading = !!opportunityId && form?.id !== opportunityId

  /** Swap the pipeline the deal belongs to. Fetches the target
   *  pipeline's stages, defaults the stageId to the first stage, and
   *  keeps the working form in sync. */
  function handlePipelineChange(nextPipelineId: string) {
    if (!form || nextPipelineId === form.pipelineId) return
    setLoadingStages(true)
    fetchPipelineStagesAction(nextPipelineId).then((res) => {
      setLoadingStages(false)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not load stages')
        return
      }
      // StageWithCount is PipelineStage + dealCount; the extra field
      // is harmless in the select-options render below.
      const nextStages = res.data as PipelineStage[]
      setPipelineStages(nextStages)
      setForm((prev) =>
        prev
          ? {
              ...prev,
              pipelineId: nextPipelineId,
              stageId: nextStages[0]?.id ?? '',
            }
          : prev,
      )
    })
  }

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
      setInitialPipelineId(d.pipelineId)
      setInitialStatus(d.status)
      setConfirmingDelete(false)
      setSection('details')
      setPipelineStages(stages)
      // Build a LeadListItem-compatible shape from the joined contact
      // (only fields the picker cares about need to be real). The
      // service always joins when linked, but a legacy row can still
      // return contact=null.
      const contactRef: LeadListItem | null = d.contact
        ? {
            id: d.contact.id,
            fullName: d.contact.fullName,
            email: d.contact.email,
            phone: d.contact.phone,
            companyName: d.contact.companyName,
            source: 'MANUAL',
            campaign: null,
            industry: null,
            status: 'CONVERTED',
            assignedSetter: null,
            convertedOpportunityId: null,
            lastActivityAt: null,
            createdAt: new Date(),
            opportunityCount: 0,
          }
        : null
      setForm({
        id: d.id,
        name: d.name,
        value: d.value === null ? '' : String(d.value),
        probability: d.probability === null ? '' : String(d.probability),
        expectedCloseDate: d.expectedCloseDate
          ? toCalendarDateInput(d.expectedCloseDate)
          : '',
        assignedCloserId: d.assignedCloser?.id ?? '',
        notes: d.notes ?? '',
        source: d.source ?? '',
        status: d.status,
        pipelineId: d.pipelineId,
        stageId: d.stageId,
        contact: contactRef,
        contactDraft: null,
      })
    })
    return () => {
      cancelled = true
    }
  }, [opportunityId, onOpenChange])

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: val } : prev))
  }

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
      // Stage / pipeline change goes first so the stage-driven status
      // auto-flip runs before we apply a manual status override below.
      const stageOrPipelineChanged =
        form.stageId !== initialStageId ||
        form.pipelineId !== initialPipelineId
      if (form.stageId && stageOrPipelineChanged) {
        const moveRes = await moveOpportunityAction({
          opportunityId,
          stageId: form.stageId,
        })
        if (!moveRes.ok) {
          toast.error(moveRes.error ?? 'Could not move stage')
          return
        }
      }

      // Only send status when the user actually changed it — the move
      // above may have already flipped it, and passing it unchanged
      // would re-stamp wonAt/lostAt for no reason.
      const statusChanged = form.status !== initialStatus

      // Contact resolution: pick > inline draft > leave alone. The
      // service accepts contactId directly, or free-text fields it
      // uses to find-or-create.
      const contactPayload: {
        contactId?: string | null
        contactName?: string | null
        contactEmail?: string | null
        contactPhone?: string | null
        companyName?: string | null
      } = form.contact
        ? { contactId: form.contact.id }
        : form.contactDraft
          ? {
              contactId: null,
              contactName: form.contactDraft.fullName,
              contactEmail: form.contactDraft.email,
              contactPhone: form.contactDraft.phone,
              companyName: form.contactDraft.companyName,
            }
          : {}

      const res = await updateOpportunityAction(opportunityId, {
        name: form.name.trim(),
        value: parsedValue,
        probability: parsedProb,
        expectedCloseDate: form.expectedCloseDate || undefined,
        assignedCloserId: form.assignedCloserId || null,
        notes: form.notes.trim() || null,
        source: form.source.trim() || null,
        ...contactPayload,
        ...(statusChanged ? { status: form.status } : {}),
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not save opportunity')
        return
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
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
          <div className="mt-4 flex flex-col gap-6 sm:flex-row">
            {/* Left rail — section navigation. Details/Tasks/Notes are
                live; the rest are placeholders for tabs that ship in
                later phases. */}
            <aside className="flex flex-row items-stretch gap-1 overflow-x-auto border-b pb-3 sm:w-56 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
              <NavItem
                active={section === 'details'}
                onClick={() => setSection('details')}
                label="Opportunity details"
              />
              <NavItem
                disabled
                icon={Calendar}
                label="Book or update appointment"
              />
              <NavItem
                active={section === 'tasks'}
                onClick={() => setSection('tasks')}
                icon={CheckSquare}
                label="Tasks"
              />
              <NavItem
                active={section === 'notes'}
                onClick={() => setSection('notes')}
                icon={StickyNote}
                label="Notes"
              />
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
            {section === 'tasks' ? (
              <div className="min-w-0 flex-1">
                <OpportunityTasksPanel
                  opportunityId={form.id}
                  members={members}
                  onChanged={onChanged}
                />
                <div className="mt-6 flex justify-end border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : section === 'notes' ? (
              <div className="min-w-0 flex-1">
                <OpportunityNotesPanel
                  opportunityId={form.id}
                  onChanged={onChanged}
                />
                <div className="mt-6 flex justify-end border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} className="min-w-0 flex-1 space-y-6">
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">
                      Contact details
                    </h3>
                  </div>
                  <ContactPicker
                    label="Contact"
                    selectedContact={form.contact}
                    onPick={(c) =>
                      setForm((prev) =>
                        prev
                          ? { ...prev, contact: c, contactDraft: null }
                          : prev,
                      )
                    }
                    onInlineCreate={(draft) =>
                      setForm((prev) =>
                        prev
                          ? { ...prev, contact: null, contactDraft: draft }
                          : prev,
                      )
                    }
                    onClear={() =>
                      setForm((prev) =>
                        prev
                          ? { ...prev, contact: null, contactDraft: null }
                          : prev,
                      )
                    }
                    disabled={pending}
                  />
                  {form.contactDraft ? (
                    <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      New contact <b>{form.contactDraft.fullName}</b> will be
                      created on save.
                    </p>
                  ) : null}
                  {/* Read-only phone readout so a closer can see + call the
                      lead. The number lives on the contact record; edit it
                      via the contact, not the deal. */}
                  {(() => {
                    const phone =
                      form.contact?.phone ?? form.contactDraft?.phone ?? null
                    return phone ? (
                      <div className="grid gap-1.5">
                        <Label className="text-xs font-medium">
                          Phone number
                        </Label>
                        <a
                          href={`tel:${phone}`}
                          className="w-fit text-sm text-primary hover:underline"
                        >
                          {phone}
                        </a>
                      </div>
                    ) : null
                  })()}
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
                      <select
                        id="edit-pipeline"
                        value={form.pipelineId}
                        onChange={(e) => handlePipelineChange(e.target.value)}
                        disabled={loadingStages || pending}
                        className={SELECT_CLASS}
                      >
                        {pipelines.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field id="edit-stage" label="Stage">
                      <select
                        id="edit-stage"
                        value={form.stageId}
                        onChange={(e) => set('stageId', e.target.value)}
                        disabled={loadingStages || pending}
                        className={SELECT_CLASS}
                      >
                        {pipelineStages.map((s) => (
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
                        onChange={(e) =>
                          set(
                            'status',
                            e.target.value as 'OPEN' | 'WON' | 'LOST',
                          )
                        }
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
                          // Stop the browser's scroll-adjusts-value
                          // behavior. Focus loss is the tradeoff, but
                          // silently mutating dollar amounts is worse.
                          onWheel={(e) => e.currentTarget.blur()}
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
                        onWheel={(e) => e.currentTarget.blur()}
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
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="edit-closer" label="Assigned to">
                      <select
                        id="edit-closer"
                        value={form.assignedCloserId}
                        onChange={(e) =>
                          set('assignedCloserId', e.target.value)
                        }
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
                    <Field id="edit-source" label="Source">
                      <Input
                        id="edit-source"
                        value={form.source}
                        onChange={(e) => set('source', e.target.value)}
                        placeholder="e.g. Facebook, Referral"
                        maxLength={100}
                      />
                    </Field>
                  </div>
                  <Field id="edit-notes" label="Description">
                    <Textarea
                      id="edit-notes"
                      value={form.notes}
                      onChange={(e) => set('notes', e.target.value)}
                      rows={3}
                      placeholder="Context, next steps…"
                    />
                  </Field>
                </section>

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
          </div>
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
  onClick,
}: {
  active?: boolean
  disabled?: boolean
  icon?: React.ComponentType<{ className?: string }>
  label: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
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
