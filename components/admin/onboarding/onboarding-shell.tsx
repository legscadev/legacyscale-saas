'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  AlertTriangle,
  Check,
  CircleDashed,
  ListChecks,
  Loader2,
  MinusCircle,
  Plus,
  Search,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader, EmptyState } from '@/components/shared'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { EmployeeListItem } from '@/lib/services/employee-service'
import type { ChecklistItem } from '@/lib/services/checklist-service'
import {
  CHECKLIST_STATUS_LABELS,
  type ChecklistItemStatusValue,
} from '@/lib/validations/employee'

import { updateChecklistItemStatusAction } from '@/app/(admin)/admin/onboarding/actions'
import { NewEmployeeDialog } from './new-employee-dialog'

interface OnboardingShellProps {
  initialEmployees: EmployeeListItem[]
  initialItems: ChecklistItem[]
}

type TabKey = 'active' | 'offboarded'

const STATUS_OPTIONS: ChecklistItemStatusValue[] = [
  'PENDING',
  'OK',
  'ATTENTION',
  'NA',
]

function formatDate(date: Date | null | undefined) {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'MMM d, yyyy')
}

// Colour + icon lookup for cell rendering. Kept out of the component
// so the JSX below stays scannable.
const CELL_STYLE: Record<
  ChecklistItemStatusValue,
  { className: string; Icon: typeof Check }
> = {
  OK: {
    className:
      'bg-emerald-500 text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500',
    Icon: Check,
  },
  ATTENTION: {
    className:
      'bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-400',
    Icon: AlertTriangle,
  },
  PENDING: {
    className:
      'bg-transparent text-muted-foreground/70 ring-1 ring-inset ring-border hover:bg-muted',
    Icon: CircleDashed,
  },
  NA: {
    className:
      'bg-muted text-muted-foreground/60 hover:bg-muted/70',
    Icon: MinusCircle,
  },
}

export function OnboardingShell({
  initialEmployees,
  initialItems,
}: OnboardingShellProps) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('active')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // We hold local employee state so cell edits reflect instantly
  // without waiting for a router.refresh() round-trip.
  const [employees, setEmployees] = useState(initialEmployees)

  const activeCount = useMemo(
    () => employees.filter((e) => e.status === 'ACTIVE').length,
    [employees],
  )
  const offboardedCount = employees.length - activeCount

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return employees.filter((e) => {
      if (tab === 'active' && e.status !== 'ACTIVE') return false
      if (tab === 'offboarded' && e.status !== 'OFFBOARDED') return false
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        e.roleTitle.toLowerCase().includes(q)
      )
    })
  }, [employees, tab, search])

  const anyAttention = rows.some((r) => r.checklist.attentionCount > 0)

  function handleCellStatusChange(
    employeeId: string,
    itemId: string,
    next: ChecklistItemStatusValue,
    current: ChecklistItemStatusValue,
  ) {
    if (next === current) return

    // Optimistic update — the cell recolours instantly. If the server
    // rejects, we roll back to the pre-change status and toast.
    const previous = employees
    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id !== employeeId) return e
        const nextMap = { ...e.statusByItemId, [itemId]: next }
        // Recount the summary too so the "N needs attention" banner
        // stays truthful without a refetch.
        let ok = 0
        let pending = 0
        let attention = 0
        for (const s of Object.values(nextMap)) {
          if (s === 'OK') ok++
          else if (s === 'PENDING') pending++
          else if (s === 'ATTENTION') attention++
        }
        return {
          ...e,
          statusByItemId: nextMap,
          checklist: {
            ...e.checklist,
            okCount: ok,
            pendingCount: pending,
            attentionCount: attention,
          },
        }
      }),
    )

    startTransition(async () => {
      try {
        await updateChecklistItemStatusAction(employeeId, itemId, {
          status: next,
        })
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to update status',
        )
        setEmployees(previous)
      }
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding"
        description="Track hiring pipeline, checklist progress, and offboarding history for the internal team."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/onboarding/checklist"
              className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ListChecks className="mr-1.5 size-4" />
              Edit checklist
            </Link>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Add employee
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as TabKey)}
          className="w-full sm:w-auto"
        >
          <TabsList>
            <TabsTrigger value="active">
              Active
              <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {activeCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="offboarded">
              Offboarded
              <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {offboardedCount}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or role"
            className="pl-9"
          />
        </div>
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Saving…
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          tone={tab === 'active' ? 'brand' : 'neutral'}
          title={
            search
              ? 'No matches'
              : tab === 'active'
                ? 'No active employees yet'
                : 'No one has been offboarded'
          }
          description={
            search
              ? 'Try a different name or role.'
              : tab === 'active'
                ? 'Add your first hire to start tracking their onboarding.'
                : 'Offboarded team members will appear here.'
          }
        >
          {tab === 'active' && !search ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 size-4" />
              Add employee
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <OnboardingMatrix
          rows={rows}
          items={initialItems}
          tab={tab}
          isPending={isPending}
          onCellChange={handleCellStatusChange}
          onNameClick={(id) => router.push(`/admin/onboarding/${id}`)}
        />
      )}

      {anyAttention ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200/70 bg-amber-50/60 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            Some employees have items flagged for attention. Amber cells
            below need follow-up.
          </div>
        </div>
      ) : null}

      <NewEmployeeDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

// ---------------------------------------------------------------------
// Matrix table — spreadsheet-style view
// ---------------------------------------------------------------------

function OnboardingMatrix({
  rows,
  items,
  tab,
  isPending,
  onCellChange,
  onNameClick,
}: {
  rows: EmployeeListItem[]
  items: ChecklistItem[]
  tab: TabKey
  isPending: boolean
  onCellChange: (
    employeeId: string,
    itemId: string,
    next: ChecklistItemStatusValue,
    current: ChecklistItemStatusValue,
  ) => void
  onNameClick: (employeeId: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-muted/40">
              <th className="sticky left-0 z-20 bg-muted/40 px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Name
              </th>
              <th className="sticky left-[180px] z-20 border-l bg-muted/40 px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Role
              </th>
              <th className="border-l bg-muted/40 px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                {tab === 'offboarded' ? 'Offboarded' : 'Onboarded'}
              </th>
              {items.map((item) => (
                <th
                  key={item.id}
                  className="border-l bg-muted/40 px-2 py-2 text-center text-[10px] font-medium uppercase tracking-tight text-muted-foreground whitespace-nowrap"
                  title={item.label}
                >
                  <span className="inline-block max-w-[110px] truncate">
                    {item.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id}
                className={cn(
                  'transition-colors',
                  i % 2 === 1 ? 'bg-muted/10' : '',
                  'hover:bg-muted/25',
                )}
              >
                <td
                  className={cn(
                    'sticky left-0 z-10 border-t bg-card px-3 py-2 font-medium',
                    i % 2 === 1 && 'bg-muted/10',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onNameClick(row.id)}
                    className="flex items-center gap-2 text-left hover:text-primary"
                  >
                    <span className="truncate">{row.name}</span>
                    {row.checklist.attentionCount > 0 ? (
                      <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
                    ) : null}
                  </button>
                </td>
                <td
                  className={cn(
                    'sticky left-[180px] z-10 border-l border-t bg-card px-3 py-2 text-muted-foreground',
                    i % 2 === 1 && 'bg-muted/10',
                  )}
                >
                  <span className="block max-w-[180px] truncate">
                    {row.roleTitle}
                  </span>
                </td>
                <td className="border-l border-t px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {formatDate(
                    tab === 'offboarded'
                      ? row.offboardingDate
                      : row.onboardingDate,
                  )}
                </td>
                {items.map((item) => {
                  const current =
                    (row.statusByItemId[item.id] as ChecklistItemStatusValue | undefined) ??
                    'PENDING'
                  return (
                    <td
                      key={item.id}
                      className="border-l border-t px-2 py-1.5 text-center"
                    >
                      <StatusCell
                        current={current}
                        label={item.label}
                        disabled={isPending}
                        onChange={(next) =>
                          onCellChange(row.id, item.id, next, current)
                        }
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusCell({
  current,
  label,
  disabled,
  onChange,
}: {
  current: ChecklistItemStatusValue
  label: string
  disabled: boolean
  onChange: (next: ChecklistItemStatusValue) => void
}) {
  const { className, Icon } = CELL_STYLE[current]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label}: ${CHECKLIST_STATUS_LABELS[current]}. Click to change.`}
        disabled={disabled}
        render={
          <button
            type="button"
            title={`${label} · ${CHECKLIST_STATUS_LABELS[current]}`}
            className={cn(
              'grid size-6 place-items-center rounded-full transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              className,
            )}
          />
        }
      >
        <Icon className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-[9rem]">
        {STATUS_OPTIONS.map((s) => {
          const style = CELL_STYLE[s]
          const SIcon = style.Icon
          return (
            <DropdownMenuItem
              key={s}
              onClick={() => onChange(s)}
              className={cn(
                'gap-2 text-sm',
                s === current && 'bg-muted font-medium',
              )}
            >
              <span
                className={cn(
                  'grid size-4 place-items-center rounded-full',
                  style.className,
                )}
              >
                <SIcon className="size-2.5" />
              </span>
              {CHECKLIST_STATUS_LABELS[s]}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
