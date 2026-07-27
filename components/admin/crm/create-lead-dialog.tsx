'use client'

// Create-lead dialog (manual entry). fullName is the only required
// field. As the operator fills email/phone, a debounced dedupe probe
// warns (non-blocking) when a matching lead already exists — the same
// person can legitimately come in twice, so it's a nudge not a gate.

import { useRef, useState, useTransition } from 'react'
import { AlertTriangle } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import type { LeadListItem } from '@/lib/services/crm-lead-service'
import {
  CRM_LEAD_SOURCE_LABELS,
  type CrmLeadSourceValue,
} from '@/lib/validations/crm-lead'

import {
  checkLeadDuplicatesAction,
  createLeadAction,
} from '@/app/(admin)/admin/crm/leads/actions'
import type { CrmTeamMember } from '@/app/(admin)/admin/crm/leads/actions'

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface CreateLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: CrmTeamMember[]
  onCreated: (lead: LeadListItem) => void
}

export function CreateLeadDialog({
  open,
  onOpenChange,
  members,
  onCreated,
}: CreateLeadDialogProps) {
  const [pending, startTransition] = useTransition()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [source, setSource] = useState<CrmLeadSourceValue>('MANUAL')
  const [campaign, setCampaign] = useState('')
  const [industry, setIndustry] = useState('')
  const [assignedSetterId, setAssignedSetterId] = useState('')
  const [notes, setNotes] = useState('')
  const [dupes, setDupes] = useState<LeadListItem[]>([])
  const dupeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function reset() {
    setFullName('')
    setEmail('')
    setPhone('')
    setCompanyName('')
    setSource('MANUAL')
    setCampaign('')
    setIndustry('')
    setAssignedSetterId('')
    setNotes('')
    setDupes([])
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  /** Debounced dedupe probe — fires ~400ms after the operator stops
   *  typing an email/phone. */
  function scheduleDupeCheck(nextEmail: string, nextPhone: string) {
    if (dupeTimer.current) clearTimeout(dupeTimer.current)
    const e = nextEmail.trim()
    const p = nextPhone.trim()
    if (!e && !p) {
      setDupes([])
      return
    }
    dupeTimer.current = setTimeout(async () => {
      const res = await checkLeadDuplicatesAction({ email: e || null, phone: p || null })
      if (res.ok) setDupes(res.data)
    }, 400)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) {
      toast.error('Name is required')
      return
    }
    startTransition(async () => {
      const res = await createLeadAction({
        fullName: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        companyName: companyName.trim() || null,
        source,
        campaign: campaign.trim() || null,
        industry: industry.trim() || null,
        assignedSetterId: assignedSetterId || null,
        notes: notes.trim() || null,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not create lead')
        return
      }
      toast.success('Lead captured')
      onCreated(res.data)
      handleOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New lead</DialogTitle>
            <DialogDescription>
              Capture an inbound lead. Only a name is required.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="lead-name">Full name</Label>
              <Input
                id="lead-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="lead-email">Email</Label>
                <Input
                  id="lead-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    scheduleDupeCheck(e.target.value, phone)
                  }}
                  placeholder="jane@acme.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="lead-phone">Phone</Label>
                <Input
                  id="lead-phone"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    scheduleDupeCheck(email, e.target.value)
                  }}
                  placeholder="+1 555 010 0000"
                />
              </div>
            </div>

            {dupes.length > 0 ? (
              <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <div>
                  <p className="font-medium">
                    {dupes.length} possible duplicate
                    {dupes.length > 1 ? 's' : ''} already in the inbox:
                  </p>
                  <ul className="mt-0.5 list-disc pl-4">
                    {dupes.slice(0, 3).map((d) => (
                      <li key={d.id}>
                        {d.fullName}
                        {d.email ? ` · ${d.email}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="lead-company">Company</Label>
                <Input
                  id="lead-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="lead-source">Source</Label>
                <select
                  id="lead-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value as CrmLeadSourceValue)}
                  className={SELECT_CLASS}
                >
                  {(Object.keys(CRM_LEAD_SOURCE_LABELS) as CrmLeadSourceValue[]).map(
                    (s) => (
                      <option key={s} value={s}>
                        {CRM_LEAD_SOURCE_LABELS[s]}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="lead-campaign">Campaign</Label>
                <Input
                  id="lead-campaign"
                  value={campaign}
                  onChange={(e) => setCampaign(e.target.value)}
                  placeholder="Q3 webinar"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="lead-industry">Industry</Label>
                <Input
                  id="lead-industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="SaaS"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="lead-setter">Assign setter</Label>
              <select
                id="lead-setter"
                value={assignedSetterId}
                onChange={(e) => setAssignedSetterId(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="lead-notes">Notes</Label>
              <Textarea
                id="lead-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Where did they come from, what do they want…"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Add lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
