'use client'

// Search-as-you-type picker for CRM contacts (crm_leads rows). Used
// inside the New/Edit Opportunity dialogs to attach a deal to a
// contact — GHL model where every opportunity hangs off a Contact.
//
// The picker has three states:
//   1. `selectedContact` set → shows a chip with name + email + a
//      "Change" button to reopen the search.
//   2. Search open → text input filters against name/email/company;
//      results render as a list; empty-query returns most-recent.
//   3. No match → "+ Add new contact" button opens an inline form
//      that posts through onCreateInline (caller decides whether to
//      create-then-select or defer until save).
//
// The component is dumb about persistence: it emits (contactId,
// snapshot) on select or (draft) on inline-create. The parent dialog
// wires that into the opportunity payload.

import { useEffect, useRef, useState, useTransition } from 'react'
import { Loader2, Search, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'

import { searchContactsForPickerAction } from '@/app/(admin)/admin/crm/opportunities/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { LeadListItem } from '@/lib/services/crm-lead-service'

/** Draft-contact shape emitted when the user fills the inline form
 *  and the caller wants to defer the actual insert to the save path. */
export interface InlineContactDraft {
  fullName: string
  email: string | null
  phone: string | null
  companyName: string | null
}

interface Props {
  /** Currently linked contact (initial value from opportunity.contact). */
  selectedContact: LeadListItem | null
  /** Fired when the user picks an existing contact from the results. */
  onPick: (contact: LeadListItem) => void
  /** Fired when the user fills the inline "Add new contact" form.
   *  Parent decides whether to create it now (via a server action) or
   *  stash it in state to send with the opportunity payload. */
  onInlineCreate: (draft: InlineContactDraft) => void
  /** Fired when the user explicitly clears the picker. */
  onClear?: () => void
  disabled?: boolean
  label?: string
}

export function ContactPicker({
  selectedContact,
  onPick,
  onInlineCreate,
  onClear,
  disabled,
  label = 'Contact',
}: Props) {
  const [open, setOpen] = useState(!selectedContact)
  const [inlineOpen, setInlineOpen] = useState(false)

  // If parent updates selectedContact (e.g. after a save), collapse.
  useEffect(() => {
    if (selectedContact) {
      setOpen(false)
      setInlineOpen(false)
    }
  }, [selectedContact])

  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium">{label}</Label>

      {selectedContact && !open ? (
        <SelectedContactChip
          contact={selectedContact}
          onChange={() => setOpen(true)}
          onClear={
            onClear
              ? () => {
                  onClear()
                  setOpen(true)
                }
              : undefined
          }
          disabled={disabled}
        />
      ) : inlineOpen ? (
        <InlineCreateForm
          onCancel={() => setInlineOpen(false)}
          onSubmit={(draft) => {
            onInlineCreate(draft)
            setInlineOpen(false)
          }}
        />
      ) : (
        <SearchPanel
          onPick={onPick}
          onCreateInline={() => setInlineOpen(true)}
          disabled={disabled}
        />
      )}
    </div>
  )
}

function SelectedContactChip({
  contact,
  onChange,
  onClear,
  disabled,
}: {
  contact: LeadListItem
  onChange: () => void
  onClear?: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{contact.fullName}</p>
        {contact.email || contact.companyName ? (
          <p className="truncate text-xs text-muted-foreground">
            {[contact.email, contact.companyName].filter(Boolean).join(' · ')}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onChange}
          disabled={disabled}
        >
          Change
        </Button>
        {onClear ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClear}
            disabled={disabled}
            aria-label="Detach contact"
            className="size-7 text-muted-foreground hover:text-destructive"
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function SearchPanel({
  onPick,
  onCreateInline,
  disabled,
}: {
  onPick: (c: LeadListItem) => void
  onCreateInline: () => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LeadListItem[]>([])
  const [loading, startTransition] = useTransition()
  const debouncedQuery = useDebouncedValue(query, 200)

  useEffect(() => {
    startTransition(async () => {
      const res = await searchContactsForPickerAction(debouncedQuery)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not load contacts')
        return
      }
      setResults(res.data)
    })
  }, [debouncedQuery])

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Search contacts by name, email, or company"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          className="h-9 pl-8 text-sm"
        />
      </div>

      <div className="max-h-56 overflow-y-auto rounded-md border">
        {loading && results.length === 0 ? (
          <div className="flex h-16 items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="mr-2 size-3.5 animate-spin" />
            Loading…
          </div>
        ) : results.length === 0 ? (
          <p className="p-3 text-center text-xs text-muted-foreground">
            No matching contacts.
          </p>
        ) : (
          <ul className="divide-y">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  disabled={disabled}
                  className="w-full px-3 py-2 text-left transition-colors hover:bg-accent"
                >
                  <p className="truncate text-sm font-medium">{c.fullName}</p>
                  {c.email || c.companyName ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.email, c.companyName].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCreateInline}
        disabled={disabled}
        className="w-full"
      >
        <UserPlus className="mr-1.5 size-3.5" />
        Add new contact
      </Button>
    </div>
  )
}

function InlineCreateForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void
  onSubmit: (draft: InlineContactDraft) => void
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) {
      toast.error('Contact name is required')
      return
    }
    onSubmit({
      fullName: fullName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      companyName: companyName.trim() || null,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-2 rounded-md border bg-muted/20 p-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <Input
          autoFocus
          placeholder="Full name *"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={200}
        />
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={320}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={50}
        />
        <Input
          placeholder="Company"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          maxLength={200}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm">
          Use this contact
        </Button>
      </div>
    </form>
  )
}

/** Local debounce hook — kept inline to avoid a new util file for a
 *  one-off usage inside the picker. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setDebounced(value), delayMs)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [value, delayMs])

  return debounced
}