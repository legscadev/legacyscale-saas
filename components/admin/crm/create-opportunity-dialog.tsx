'use client'

// Create-opportunity dialog — matches HighLevel's "Add new opportunity"
// layout: a narrow left rail with section navigation + a two-column
// right pane split into Contact details and Opportunity details.
// Only Opportunity name is required; the rest are opt-in. On submit
// it calls createOpportunityAction and hands the new card back to
// the shell for an optimistic insert.

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Settings2 } from 'lucide-react'

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

import { createOpportunityAction } from '@/app/(admin)/admin/crm/opportunities/actions'
import type { OpportunityListItem } from '@/lib/services/crm-opportunity-service'
import type {
  PipelineStage,
  PipelineSummary,
} from '@/lib/services/crm-pipeline-service'
import type { CrmTeamMember } from '@/app/(admin)/admin/crm/opportunities/actions'

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface CreateOpportunityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipelineId: string
  pipelines: PipelineSummary[]
  stages: PipelineStage[]
  members: CrmTeamMember[]
  /** Pre-selected stage when opened from a column's "add" affordance. */
  defaultStageId?: string
  onCreated: (opportunity: OpportunityListItem) => void
}

export function CreateOpportunityDialog({
  open,
  onOpenChange,
  pipelineId: initialPipelineId,
  pipelines,
  stages,
  members,
  defaultStageId,
  onCreated,
}: CreateOpportunityDialogProps) {
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [pipelineId, setPipelineId] = useState(initialPipelineId)
  const [stageId, setStageId] = useState(defaultStageId ?? '')
  const [status, setStatus] = useState<'OPEN' | 'WON' | 'LOST'>('OPEN')
  const [value, setValue] = useState('')
  const [assignedCloserId, setAssignedCloserId] = useState('')

  function reset() {
    setName('')
    setContactName('')
    setContactEmail('')
    setContactPhone('')
    setPipelineId(initialPipelineId)
    setStageId(defaultStageId ?? stages[0]?.id ?? '')
    setStatus('OPEN')
    setValue('')
    setAssignedCloserId('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Opportunity name is required')
      return
    }

    const parsedValue = value.trim() === '' ? null : Number(value)
    if (parsedValue !== null && Number.isNaN(parsedValue)) {
      toast.error('Value must be a number')
      return
    }

    startTransition(async () => {
      const res = await createOpportunityAction(pipelineId, {
        name: name.trim(),
        stageId: stageId || undefined,
        status,
        value: parsedValue,
        contactName: contactName.trim() || null,
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        assignedCloserId: assignedCloserId || null,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not create opportunity')
        return
      }
      toast.success('Opportunity added')
      onCreated(res.data)
      handleOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add new opportunity</DialogTitle>
            <DialogDescription>
              Create a new opportunity by filling in details and
              selecting a contact.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-6 sm:flex-row">
            {/* Left rail — section nav. Only one section for now;
                "Manage fields" is a placeholder until custom fields
                ship. */}
            <aside className="flex flex-row items-center justify-between gap-2 border-b pb-3 sm:w-48 sm:flex-col sm:items-stretch sm:justify-start sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
              <button
                type="button"
                className="rounded-md bg-primary/10 px-3 py-2 text-left text-sm font-medium text-primary"
              >
                Opportunity details
              </button>
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

            {/* Right pane — grouped sections. */}
            <div className="min-w-0 flex-1 space-y-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Contact details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    id="opp-contact"
                    label="Primary contact name"
                    required
                  >
                    <Input
                      id="opp-contact"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Select contact"
                    />
                  </Field>
                  <Field id="opp-email" label="Primary email">
                    <Input
                      id="opp-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="Enter email"
                    />
                  </Field>
                </div>
                <Field id="opp-phone" label="Primary phone">
                  <Input
                    id="opp-phone"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Enter phone"
                  />
                </Field>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">
                  Opportunity details
                </h3>
                <Field id="opp-name" label="Opportunity name" required>
                  <Input
                    id="opp-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter opportunity name"
                    autoFocus
                    required
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="opp-pipeline" label="Pipeline">
                    <select
                      id="opp-pipeline"
                      value={pipelineId}
                      onChange={(e) => {
                        setPipelineId(e.target.value)
                        setStageId('') // reset stage when pipeline changes
                      }}
                      className={SELECT_CLASS}
                    >
                      {pipelines.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="opp-stage" label="Stage">
                    <select
                      id="opp-stage"
                      value={stageId}
                      onChange={(e) => setStageId(e.target.value)}
                      className={SELECT_CLASS}
                      disabled={pipelineId !== initialPipelineId}
                      title={
                        pipelineId !== initialPipelineId
                          ? "Save the opportunity — it'll drop into the first stage of the selected pipeline."
                          : undefined
                      }
                    >
                      {pipelineId === initialPipelineId ? (
                        stages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))
                      ) : (
                        // Different pipeline picked — we don't have
                        // its stages loaded, so surface a single
                        // placeholder and let the server drop the
                        // deal into that pipeline's first stage.
                        <option value="">First stage of selected pipeline</option>
                      )}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field id="opp-status" label="Status">
                    <select
                      id="opp-status"
                      value={status}
                      onChange={(e) =>
                        setStatus(
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
                  <Field id="opp-value" label="Value">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        $
                      </span>
                      <Input
                        id="opp-value"
                        type="number"
                        min={0}
                        step="any"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="0"
                        className={cn('no-spinner pl-6')}
                      />
                    </div>
                  </Field>
                </div>
                {members.length > 0 ? (
                  <Field id="opp-closer" label="Assigned closer">
                    <select
                      id="opp-closer"
                      value={assignedCloserId}
                      onChange={(e) => setAssignedCloserId(e.target.value)}
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
                ) : null}
              </section>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
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
