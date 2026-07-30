'use client'

// Right-side filter sheet for the Contacts (leads) surface. Mirrors
// GHL's filter drawer: a scrollable stack of field groups whose
// applied values live in the URL query string, so pagination + deep
// links keep the current view.
//
// Kept URL-driven (unlike opportunities' in-memory filter) because
// contacts are paginated server-side — the server has to know the
// facets to build the right where clause.

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  CRM_LEAD_SOURCE_LABELS,
  CRM_LEAD_STATUS_LABELS,
  type CrmLeadSourceValue,
  type CrmLeadStatusValue,
} from '@/lib/validations/crm-lead'

/** Members shape from the leads workspace payload; only fields the
 *  drawer needs. */
export interface ContactPickerMember {
  id: string
  name: string | null
  email: string
}

export interface ContactsFilterState {
  statuses: CrmLeadStatusValue[]
  sources: CrmLeadSourceValue[]
  assigneeIds: string[]
  companyName: string
  hasEmail: boolean | null
  hasPhone: boolean | null
  createdFrom: string
  createdTo: string
  lastActivityFrom: string
  lastActivityTo: string
}

export const EMPTY_CONTACTS_FILTER: ContactsFilterState = {
  statuses: [],
  sources: [],
  assigneeIds: [],
  companyName: '',
  hasEmail: null,
  hasPhone: null,
  createdFrom: '',
  createdTo: '',
  lastActivityFrom: '',
  lastActivityTo: '',
}

export function countActiveContactFilters(f: ContactsFilterState): number {
  let n = 0
  if (f.statuses.length > 0) n++
  if (f.sources.length > 0) n++
  if (f.assigneeIds.length > 0) n++
  if (f.companyName.trim()) n++
  if (f.hasEmail !== null) n++
  if (f.hasPhone !== null) n++
  if (f.createdFrom || f.createdTo) n++
  if (f.lastActivityFrom || f.lastActivityTo) n++
  return n
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: ContactsFilterState
  members: ContactPickerMember[]
  onApply: (next: ContactsFilterState) => void
}

export function ContactsFilterDrawer({
  open,
  onOpenChange,
  value,
  members,
  onApply,
}: Props) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (open) setDraft(value)
  }, [open, value])

  function toggleInSet<T>(set: T[], val: T): T[] {
    return set.includes(val) ? set.filter((x) => x !== val) : [...set, val]
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>
            Narrow the contacts list — filters apply live.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-6">
          <FilterGroup title="Status">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(CRM_LEAD_STATUS_LABELS) as CrmLeadStatusValue[]).map(
                (st) => {
                  const active = draft.statuses.includes(st)
                  return (
                    <Chip
                      key={st}
                      active={active}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          statuses: toggleInSet(draft.statuses, st),
                        })
                      }
                    >
                      {CRM_LEAD_STATUS_LABELS[st]}
                    </Chip>
                  )
                },
              )}
            </div>
          </FilterGroup>

          <FilterGroup title="Source">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(CRM_LEAD_SOURCE_LABELS) as CrmLeadSourceValue[]).map(
                (s) => {
                  const active = draft.sources.includes(s)
                  return (
                    <Chip
                      key={s}
                      active={active}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          sources: toggleInSet(draft.sources, s),
                        })
                      }
                    >
                      {CRM_LEAD_SOURCE_LABELS[s]}
                    </Chip>
                  )
                },
              )}
            </div>
          </FilterGroup>

          <FilterGroup title="Assigned to">
            <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {members.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No team members yet.
                </p>
              ) : (
                members.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent/40"
                  >
                    <Checkbox
                      checked={draft.assigneeIds.includes(m.id)}
                      onCheckedChange={() =>
                        setDraft({
                          ...draft,
                          assigneeIds: toggleInSet(draft.assigneeIds, m.id),
                        })
                      }
                    />
                    <span className="truncate">
                      {m.name ?? m.email.split('@')[0]}
                    </span>
                  </label>
                ))
              )}
            </div>
          </FilterGroup>

          <FilterGroup title="Company">
            <Input
              value={draft.companyName}
              onChange={(e) =>
                setDraft({ ...draft, companyName: e.target.value })
              }
              placeholder="Company name contains…"
            />
          </FilterGroup>

          <FilterGroup title="Contact channels">
            <div className="grid grid-cols-2 gap-2">
              <TriState
                label="Email"
                value={draft.hasEmail}
                onChange={(v) => setDraft({ ...draft, hasEmail: v })}
              />
              <TriState
                label="Phone"
                value={draft.hasPhone}
                onChange={(v) => setDraft({ ...draft, hasPhone: v })}
              />
            </div>
          </FilterGroup>

          <FilterGroup title="Created">
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={draft.createdFrom}
                  onChange={(e) =>
                    setDraft({ ...draft, createdFrom: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={draft.createdTo}
                  onChange={(e) =>
                    setDraft({ ...draft, createdTo: e.target.value })
                  }
                />
              </div>
            </div>
          </FilterGroup>

          <FilterGroup title="Last activity">
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={draft.lastActivityFrom}
                  onChange={(e) =>
                    setDraft({ ...draft, lastActivityFrom: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={draft.lastActivityTo}
                  onChange={(e) =>
                    setDraft({ ...draft, lastActivityTo: e.target.value })
                  }
                />
              </div>
            </div>
          </FilterGroup>
        </SheetBody>

        <SheetFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(EMPTY_CONTACTS_FILTER)
              onApply(EMPTY_CONTACTS_FILTER)
              onOpenChange(false)
            }}
          >
            Clear all
          </Button>
          <Button
            onClick={() => {
              onApply(draft)
              onOpenChange(false)
            }}
          >
            Apply filters
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function FilterGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-input text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

/** null = don't filter · true = has one · false = missing one. */
function TriState({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | null
  onChange: (v: boolean | null) => void
}) {
  return (
    <div className="rounded-md border p-2">
      <p className="mb-1 text-xs font-medium">{label}</p>
      <div className="flex gap-1">
        {[
          { v: null, l: 'Any' },
          { v: true, l: 'Has' },
          { v: false, l: 'Missing' },
        ].map(({ v, l }) => (
          <button
            key={l}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              'flex-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
              value === v
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-input text-muted-foreground hover:text-foreground',
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

// -------- URL <-> filter state helpers --------

/** Build a filter state from URL search params. */
export function parseContactsFilterFromParams(
  params: URLSearchParams,
): ContactsFilterState {
  const csv = (key: string) =>
    (params.get(key) ?? '').split(',').filter(Boolean)
  const boolTri = (key: string): boolean | null => {
    const v = params.get(key)
    if (v === '1' || v === 'true') return true
    if (v === '0' || v === 'false') return false
    return null
  }
  return {
    statuses: csv('statuses') as CrmLeadStatusValue[],
    sources: csv('sources') as CrmLeadSourceValue[],
    assigneeIds: csv('assignees'),
    companyName: params.get('company') ?? '',
    hasEmail: boolTri('has_email'),
    hasPhone: boolTri('has_phone'),
    createdFrom: params.get('created_from') ?? '',
    createdTo: params.get('created_to') ?? '',
    lastActivityFrom: params.get('activity_from') ?? '',
    lastActivityTo: params.get('activity_to') ?? '',
  }
}

/** Serialise a filter state into a partial URL-param patch. Every
 *  filter key is set to null when its value is empty so the setParams
 *  helper strips it from the URL — keeps hrefs short. */
export function contactsFilterToParams(
  f: ContactsFilterState,
): Record<string, string | null> {
  return {
    statuses: f.statuses.length ? f.statuses.join(',') : null,
    sources: f.sources.length ? f.sources.join(',') : null,
    assignees: f.assigneeIds.length ? f.assigneeIds.join(',') : null,
    company: f.companyName.trim() || null,
    has_email: f.hasEmail === null ? null : f.hasEmail ? '1' : '0',
    has_phone: f.hasPhone === null ? null : f.hasPhone ? '1' : '0',
    created_from: f.createdFrom || null,
    created_to: f.createdTo || null,
    activity_from: f.lastActivityFrom || null,
    activity_to: f.lastActivityTo || null,
  }
}
