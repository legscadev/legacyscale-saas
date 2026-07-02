'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  UserPlus,
} from 'lucide-react'

import { PageHeader, EmptyState } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { EmployeeListItem } from '@/lib/services/employee-service'
import type { TemplateListItem } from '@/lib/services/checklist-template-service'

import { ChecklistsTab } from './checklists-tab'
import { NewEmployeeDialog } from './new-employee-dialog'

export type EmployeeRow = Pick<
  EmployeeListItem,
  | 'id'
  | 'name'
  | 'roleTitle'
  | 'status'
  | 'onboardingDate'
  | 'dateStarted'
  | 'offboardingDate'
> & {
  checklist: EmployeeListItem['checklist']
}

interface OnboardingShellProps {
  initialEmployees: EmployeeRow[]
  initialTemplates: TemplateListItem[]
}

type TabKey = 'active' | 'offboarded' | 'checklists'

function formatDate(date: Date | null | undefined) {
  if (!date) return '—'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'MMM d, yyyy')
}

function ChecklistBar({
  checklist,
}: {
  checklist: EmployeeRow['checklist']
}) {
  const { totalItems, okCount, pendingCount, attentionCount } = checklist
  if (totalItems === 0) {
    return <span className="text-xs text-muted-foreground">No template</span>
  }
  const okPct = (okCount / totalItems) * 100
  const attnPct = (attentionCount / totalItems) * 100
  const pendingPct = (pendingCount / totalItems) * 100
  return (
    <div className="flex min-w-[180px] items-center gap-3">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 bg-emerald-500 transition-all"
          style={{ width: `${okPct}%` }}
        />
        <div
          className="absolute inset-y-0 bg-amber-500 transition-all"
          style={{ left: `${okPct}%`, width: `${attnPct}%` }}
        />
        <div
          className="absolute inset-y-0 bg-slate-300 transition-all dark:bg-slate-600"
          style={{ left: `${okPct + attnPct}%`, width: `${pendingPct}%` }}
        />
      </div>
      <span className="tabular-nums text-xs font-medium text-muted-foreground">
        {okCount}/{totalItems}
      </span>
    </div>
  )
}

const VALID_TABS: readonly TabKey[] = ['active', 'offboarded', 'checklists']

export function OnboardingShell({
  initialEmployees,
  initialTemplates,
}: OnboardingShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Tab reads from ?tab= so linking back from a template editor page
  // (or refreshing) lands on the right tab. Unknown values fall back
  // to Active without erroring.
  const paramTab = searchParams.get('tab') as TabKey | null
  const tab: TabKey = paramTab && VALID_TABS.includes(paramTab) ? paramTab : 'active'

  function setTab(next: TabKey) {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'active') params.delete('tab')
    else params.set('tab', next)
    const qs = params.toString()
    router.replace(qs ? `/admin/onboarding?${qs}` : '/admin/onboarding')
  }

  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const onEmployeeTab = tab !== 'checklists'

  const activeCount = useMemo(
    () => initialEmployees.filter((e) => e.status === 'ACTIVE').length,
    [initialEmployees],
  )
  const offboardedCount = initialEmployees.length - activeCount

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return initialEmployees.filter((e) => {
      if (tab === 'active' && e.status !== 'ACTIVE') return false
      if (tab === 'offboarded' && e.status !== 'OFFBOARDED') return false
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        e.roleTitle.toLowerCase().includes(q)
      )
    })
  }, [initialEmployees, tab, search])

  const anyAttention = rows.some((r) => r.checklist.attentionCount > 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding"
        description="Track hiring pipeline, checklist progress, and offboarding history for the internal team."
        actions={
          onEmployeeTab ? (
            <div className="flex items-center gap-2">
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-1.5 size-4" />
                Add employee
              </Button>
            </div>
          ) : null
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
            <TabsTrigger value="checklists">
              Checklists
              <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {initialTemplates.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {onEmployeeTab ? (
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
        ) : null}
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Refreshing…
        </div>
      ) : null}

      {!onEmployeeTab ? (
        <ChecklistsTab templates={initialTemplates} />
      ) : rows.length === 0 ? (
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
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Onboarded</TableHead>
                <TableHead>Started</TableHead>
                {tab === 'offboarded' ? (
                  <TableHead>Offboarded</TableHead>
                ) : null}
                <TableHead>Checklist</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="group cursor-pointer transition-colors hover:bg-muted/40"
                  onClick={() =>
                    startTransition(() =>
                      router.push(`/admin/onboarding/${row.id}`),
                    )
                  }
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {row.name}
                      {row.checklist.attentionCount > 0 ? (
                        <AlertTriangle className="size-3.5 text-amber-500" />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.roleTitle}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.onboardingDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.dateStarted)}
                  </TableCell>
                  {tab === 'offboarded' ? (
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.offboardingDate)}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <ChecklistBar checklist={row.checklist} />
                  </TableCell>
                  <TableCell>
                    <ChevronRight
                      className={cn(
                        'size-4 text-muted-foreground/40 transition-transform',
                        'group-hover:translate-x-0.5 group-hover:text-foreground',
                      )}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {onEmployeeTab && anyAttention ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200/70 bg-amber-50/60 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            Some employees have checklist items flagged for attention. Open a
            profile to review.
          </div>
        </div>
      ) : null}

      <NewEmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        templates={initialTemplates}
      />
    </div>
  )
}
