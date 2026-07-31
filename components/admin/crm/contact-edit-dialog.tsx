'use client'

// Row-click detail popup on /admin/crm/contacts. Lands directly in
// edit mode (per user preference — power-user workflow). Fetches the
// full contact on open so notes / secondaryPhone / address (which the
// list projection omits) are available. Save goes through the same
// updateLeadAction the CRM already uses; on success we swap the row
// in the parent's list via onSaved.

import { useEffect, useRef, useState, useTransition } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'
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
  CRM_LEAD_STATUS_LABELS,
  type CrmLeadSourceValue,
  type CrmLeadStatusValue,
} from '@/lib/validations/crm-lead'

import {
  fetchLeadDetailAction,
  updateLeadAction,
  type LeadDetail,
} from '@/app/(admin)/admin/crm/contacts/actions'
import type { CrmTeamMember } from '@/app/(admin)/admin/crm/contacts/actions'

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface Props {
  /** Which contact to edit. Null closes the dialog. */
  contactId: string | null
  onClose: () => void
  members: CrmTeamMember[]
  /** Called after a successful save so the parent can splice the
   *  updated row into its list without a full re-fetch. */
  onSaved: (updated: LeadListItem) => void
}

export function ContactEditDialog({
  contactId,
  onClose,
  members,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [pending, startTransition] = useTransition()
  const [detail, setDetail] = useState<LeadDetail | null>(null)

  // Form state — kept separate so cancel is trivial and dirty check
  // is just JSON.stringify.
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [secondaryPhone, setSecondaryPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [address, setAddress] = useState('')
  const [source, setSource] = useState<CrmLeadSourceValue>('MANUAL')
  const [campaign, setCampaign] = useState('')
  const [industry, setIndustry] = useState('')
  const [status, setStatus] = useState<CrmLeadStatusValue>('NEW')
  const [assignedSetterId, setAssignedSetterId] = useState<string>('')
  const [notes, setNotes] = useState('')

  // Race guard for the fetch — if the user closes/reopens with a
  // different id while the first fetch is in flight, ignore the
  // stale result.
  const activeIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!contactId) {
      setDetail(null)
      return
    }
    activeIdRef.current = contactId
    setLoading(true)
    fetchLeadDetailAction(contactId).then((res) => {
      if (activeIdRef.current !== contactId) return
      setLoading(false)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not load contact')
        onClose()
        return
      }
      setDetail(res.data)
      setFullName(res.data.fullName)
      setEmail(res.data.email ?? '')
      setPhone(res.data.phone ?? '')
      setSecondaryPhone(res.data.secondaryPhone ?? '')
      setCompanyName(res.data.companyName ?? '')
      setAddress(res.data.address ?? '')
      setSource(res.data.source as CrmLeadSourceValue)
      setCampaign(res.data.campaign ?? '')
      setIndustry(res.data.industry ?? '')
      setStatus(res.data.status)
      setAssignedSetterId(res.data.assignedSetter?.id ?? '')
      setNotes(res.data.notes ?? '')
    })
  }, [contactId, onClose])

  function handleSave() {
    if (!detail) return
    if (!fullName.trim()) {
      toast.error('Full name is required')
      return
    }
    startTransition(async () => {
      const res = await updateLeadAction(detail.id, {
        fullName: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        secondaryPhone: secondaryPhone.trim() || null,
        companyName: companyName.trim() || null,
        address: address.trim() || null,
        source,
        campaign: campaign.trim() || null,
        industry: industry.trim() || null,
        assignedSetterId: assignedSetterId || null,
        notes: notes.trim() || null,
      })
      if (!res.ok) {
        // Prefer top-level error; else first fieldError.
        const first = res.fieldErrors
          ? Object.values(res.fieldErrors)[0]?.[0]
          : undefined
        toast.error(res.error ?? first ?? 'Could not save contact')
        return
      }
      toast.success('Contact saved')
      onSaved(res.data)
      onClose()
    })
  }

  return (
    <Dialog
      open={!!contactId}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit contact</DialogTitle>
          <DialogDescription>
            All fields are editable. Changes save when you click Save.
          </DialogDescription>
        </DialogHeader>

        {loading || !detail ? (
          <div className="flex flex-1 items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading contact…
          </div>
        ) : (
          <>
            <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full name" required>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={pending}
                    autoFocus
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={pending}
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={pending}
                  />
                </Field>
                <Field label="Secondary phone">
                  <Input
                    value={secondaryPhone}
                    onChange={(e) => setSecondaryPhone(e.target.value)}
                    disabled={pending}
                  />
                </Field>
                <Field label="Company">
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    disabled={pending}
                  />
                </Field>
                <Field label="Industry">
                  <Input
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    disabled={pending}
                  />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={pending}
                  />
                </Field>
                <Field label="Source">
                  <select
                    className={SELECT_CLASS}
                    value={source}
                    onChange={(e) =>
                      setSource(e.target.value as CrmLeadSourceValue)
                    }
                    disabled={pending}
                  >
                    {Object.entries(CRM_LEAD_SOURCE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Campaign">
                  <Input
                    value={campaign}
                    onChange={(e) => setCampaign(e.target.value)}
                    disabled={pending}
                  />
                </Field>
                <Field label="Status">
                  <select
                    className={SELECT_CLASS}
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as CrmLeadStatusValue)
                    }
                    disabled={pending}
                  >
                    {Object.entries(CRM_LEAD_STATUS_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Assigned to">
                  <select
                    className={SELECT_CLASS}
                    value={assignedSetterId}
                    onChange={(e) => setAssignedSetterId(e.target.value)}
                    disabled={pending || members.length === 0}
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name ?? m.email.split('@')[0]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Notes">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  disabled={pending}
                  placeholder="Anything worth remembering — call notes, context, next steps…"
                />
              </Field>

              {detail.opportunityCount > 0 ? (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
                  <p className="font-medium">
                    {detail.opportunityCount} deal
                    {detail.opportunityCount === 1 ? '' : 's'} linked to
                    this contact
                  </p>
                  <Link
                    href={`/admin/crm/opportunities?contactId=${detail.id}`}
                    className="mt-0.5 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Open in Opportunities
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
              ) : null}
            </div>

            <DialogFooter className="shrink-0">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={pending}>
                {pending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className ?? 'space-y-1.5'}>
      <Label className="text-xs">
        {label}
        {required ? (
          <span className="ml-0.5 text-destructive">*</span>
        ) : null}
      </Label>
      {children}
    </div>
  )
}
