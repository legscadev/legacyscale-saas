'use client'

// The lead inbox table. Read-oriented rows with an inline actions
// menu (assign setter, change status, convert, delete). Sorting is
// server-side (URL-driven) — clicking a sortable header replays the
// fetch via the shell's onSortChange. Mirrors the Task Tracker's
// hand-rolled table style.

import { useTransition } from 'react'
import Link from 'next/link'
import {
  ArrowUpDown,
  ArrowRight,
  Inbox,
  MoreHorizontal,
  Trash2,
  UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'

import { AvatarGroup } from '@/components/shared/avatar-group'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { LeadListItem } from '@/lib/services/crm-lead-service'
import {
  CRM_LEAD_STATUS_LABELS,
  type CrmLeadStatusValue,
} from '@/lib/validations/crm-lead'

import {
  assignLeadAction,
  changeLeadStatusAction,
  deleteLeadAction,
} from '@/app/(admin)/admin/crm/leads/actions'

import { LeadSourceBadge, LeadStatusPill } from './lead-pills'

type SortField = 'createdAt' | 'lastActivityAt' | 'fullName' | 'status'
type SortDir = 'asc' | 'desc'

interface CrmMember {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

interface LeadsTableProps {
  items: LeadListItem[]
  members: CrmMember[]
  sortBy: SortField
  sortOrder: SortDir
  onSortChange: (field: SortField) => void
  onConvert: (lead: LeadListItem) => void
  onCreate?: () => void
  /** Called after a row mutation so the shell can refresh. */
  onChanged: () => void
}

const STATUS_VALUES: CrmLeadStatusValue[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'UNQUALIFIED',
]

export function LeadsTable({
  items,
  members,
  sortBy,
  sortOrder,
  onSortChange,
  onConvert,
  onCreate,
  onChanged,
}: LeadsTableProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No contacts match these filters"
        description="Capture a contact, import a CSV, or broaden the filters."
      >
        {onCreate ? <Button onClick={onCreate}>Add a contact</Button> : null}
      </EmptyState>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead field="fullName" current={sortBy} dir={sortOrder} onSortChange={onSortChange}>
              Lead
            </SortableHead>
            <TableHead>Source</TableHead>
            <SortableHead field="status" current={sortBy} dir={sortOrder} onSortChange={onSortChange}>
              Status
            </SortableHead>
            <TableHead>Setter</TableHead>
            <SortableHead field="lastActivityAt" current={sortBy} dir={sortOrder} onSortChange={onSortChange}>
              Last activity
            </SortableHead>
            <TableHead className="w-12 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              members={members}
              onConvert={onConvert}
              onChanged={onChanged}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function LeadRow({
  lead,
  members,
  onConvert,
  onChanged,
}: {
  lead: LeadListItem
  members: CrmMember[]
  onConvert: (lead: LeadListItem) => void
  onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()
  const isConverted = lead.status === 'CONVERTED' || !!lead.convertedOpportunityId

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        toast.error(res.error ?? 'Something went wrong')
        return
      }
      toast.success(okMsg)
      onChanged()
    })
  }

  const subtitle = lead.companyName ?? lead.email

  return (
    <TableRow className={cn(pending && 'opacity-60')}>
      <TableCell>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{lead.fullName}</p>
            {lead.opportunityCount > 0 ? (
              <span
                title={`${lead.opportunityCount} opportunit${lead.opportunityCount === 1 ? 'y' : 'ies'} linked`}
                className="inline-flex items-center gap-0.5 rounded-full border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums"
              >
                {lead.opportunityCount} deal
                {lead.opportunityCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <LeadSourceBadge source={lead.source} />
      </TableCell>
      <TableCell>
        {isConverted && lead.convertedOpportunityId ? (
          <Link
            href="/admin/crm/opportunities"
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
          >
            {CRM_LEAD_STATUS_LABELS.CONVERTED}
            <ArrowRight className="size-3" />
          </Link>
        ) : (
          <LeadStatusPill status={lead.status} />
        )}
      </TableCell>
      <TableCell>
        {lead.assignedSetter ? (
          <div className="flex items-center gap-2">
            <AvatarGroup
              users={[
                {
                  name: lead.assignedSetter.name ?? lead.assignedSetter.email,
                  avatarUrl: lead.assignedSetter.avatarUrl,
                },
              ]}
              size="sm"
              max={1}
            />
            <span className="truncate text-xs text-muted-foreground">
              {lead.assignedSetter.name ?? lead.assignedSetter.email}
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground tabular-nums">
        {relativeTime(lead.lastActivityAt)}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            render={<Button variant="ghost" size="icon-sm" aria-label="Lead actions" />}
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {!isConverted ? (
              <>
                <DropdownMenuItem onClick={() => onConvert(lead)}>
                  <ArrowRight className="size-4" />
                  Convert to deal
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <UserCheck className="size-4" />
                    Assign setter
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                    <DropdownMenuItem
                      onClick={() =>
                        run(
                          () => assignLeadAction({ leadId: lead.id, setterId: null }),
                          'Setter cleared',
                        )
                      }
                    >
                      Unassigned
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {members.map((m) => (
                      <DropdownMenuItem
                        key={m.id}
                        onClick={() =>
                          run(
                            () => assignLeadAction({ leadId: lead.id, setterId: m.id }),
                            `Assigned to ${m.name ?? m.email}`,
                          )
                        }
                      >
                        {m.name ?? m.email}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowUpDown className="size-4" />
                    Change status
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {STATUS_VALUES.map((s) => (
                      <DropdownMenuItem
                        key={s}
                        disabled={s === lead.status}
                        onClick={() =>
                          run(
                            () => changeLeadStatusAction({ leadId: lead.id, status: s }),
                            `Marked ${CRM_LEAD_STATUS_LABELS[s]}`,
                          )
                        }
                      >
                        {CRM_LEAD_STATUS_LABELS[s]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                run(() => deleteLeadAction(lead.id), 'Lead deleted')
              }
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

function SortableHead({
  field,
  current,
  dir,
  onSortChange,
  children,
}: {
  field: SortField
  current: SortField
  dir: SortDir
  onSortChange: (field: SortField) => void
  children: React.ReactNode
}) {
  const active = current === field
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSortChange(field)}
        className={cn(
          'inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-foreground',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {children}
        <ArrowUpDown
          className={cn('size-3', active ? 'opacity-100' : 'opacity-40')}
        />
        {active ? (
          <span className="sr-only">{dir === 'asc' ? 'ascending' : 'descending'}</span>
        ) : null}
      </button>
    </TableHead>
  )
}
