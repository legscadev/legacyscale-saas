'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { Loader2, Network, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { OrgNodeKindValue } from '@/lib/validations/org-board'

import { createBlankOrgBoardRevisionAction } from '@/app/(admin)/admin/org-board/actions'

import { OrgFlowChart } from './org-flow-chart'
import { OrgNodeAddDialog } from './org-node-dialogs'
import { OrgNodeDrawer } from './org-node-drawer'

import { PageHeader, EmptyState } from '@/components/shared'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type {
  AuditLogEntry,
  OrgBoardRevisionSummary,
  OrgBoardTree,
  OrgNodeRow,
} from '@/lib/services/org-board-service'

import { AssignmentBadge, HolderText } from './holder-text'
import { OrgNodeMenu } from './org-node-menu'

interface OrgBoardShellProps {
  tree: OrgBoardTree | null
  revisions: OrgBoardRevisionSummary[]
  auditLogs: AuditLogEntry[]
}

// Named palette shared with the seed script. Divisions carry a
// colour token; we translate to Tailwind classes here so tree data
// stays UI-agnostic.
const DIVISION_COLORS: Record<
  string,
  { bg: string; ring: string; text: string }
> = {
  blue: {
    bg: 'bg-blue-600',
    ring: 'ring-blue-700/50',
    text: 'text-white',
  },
  amber: {
    bg: 'bg-amber-500',
    ring: 'ring-amber-600/50',
    text: 'text-white',
  },
  indigo: {
    bg: 'bg-indigo-700',
    ring: 'ring-indigo-800/50',
    text: 'text-white',
  },
  pink: {
    bg: 'bg-pink-400',
    ring: 'ring-pink-500/50',
    text: 'text-white',
  },
  emerald: {
    bg: 'bg-emerald-700',
    ring: 'ring-emerald-800/50',
    text: 'text-white',
  },
  slate: {
    bg: 'bg-slate-500',
    ring: 'ring-slate-600/50',
    text: 'text-white',
  },
  yellow: {
    bg: 'bg-yellow-500',
    ring: 'ring-yellow-600/50',
    text: 'text-white',
  },
}

const CROWN_STYLE = {
  bg: 'bg-sky-600',
  text: 'text-white',
  ring: 'ring-sky-700/40',
}

export function OrgBoardShell({
  tree,
  revisions,
  auditLogs,
}: OrgBoardShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentRevisionId =
    searchParams.get('revision') ??
    revisions.find((r) => r.isCurrent)?.id ??
    revisions[0]?.id ??
    ''

  function pickRevision(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('revision', id)
    router.push(`/admin/org-board?${params.toString()}`)
  }

  if (!tree) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Org Board"
          description="Hubbard-style organizing chart for the internal team."
        />
        <NoRevisionPrimer />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Org Board"
        description={`${tree.revision.name}${
          tree.revision.description ? ` · ${tree.revision.description}` : ''
        }`}
        actions={
          <div className="flex items-center gap-2">
            {/* Header shortcut is hidden on empty boards — the empty
                state primer already surfaces the same actions with
                more explanation, and we don't want two entry points
                fighting for attention. */}
            {tree.nodes.length > 0 ? (
              <AddRootNodeButton revisionId={tree.revision.id} />
            ) : null}
            {revisions.length > 0 ? (
              <>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Revision
                </span>
                <Select
                  value={currentRevisionId}
                  onValueChange={(v) => pickRevision(v ?? '')}
                >
                  <SelectTrigger className="h-9 min-w-[180px]">
                    <SelectValue>
                      {(v: string) => {
                        const r = revisions.find((rev) => rev.id === v)
                        if (!r) return 'Select revision'
                        return `${r.name}${r.isCurrent ? ' · current' : ''}`
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {revisions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                        {r.isCurrent ? ' · current' : ''}
                        {r.publishedAt
                          ? ` (${format(r.publishedAt, 'MMM d, yyyy')})`
                          : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : null}
          </div>
        }
      />

      {tree.nodes.length === 0 ? (
        <EmptyBoardPrimer revisionId={tree.revision.id} />
      ) : (
        <ViewSwitcher nodes={tree.nodes} />
      )}

      {auditLogs.length > 0 ? <RecentActivity entries={auditLogs} /> : null}
    </div>
  )
}

// ---------------------------------------------------------------------
// Empty-state primer — shown when the whole revision has zero nodes,
// which happens after a "delete all". Without this, there's no card
// with a menu caret to click, so the admin has nowhere to start.
// ---------------------------------------------------------------------

function AddRootNodeButton({ revisionId }: { revisionId: string }) {
  const [addKind, setAddKind] = useState<OrgNodeKindValue | null>(null)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Add"
          render={
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent"
            />
          }
        >
          <Plus className="size-4" />
          Add
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setAddKind('CROWN')}>
            <Plus className="size-3.5" />
            Role
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAddKind('DIVISION')}>
            <Plus className="size-3.5" />
            Division
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <OrgNodeAddDialog
        open={addKind !== null}
        onOpenChange={(v) => !v && setAddKind(null)}
        target={{ mode: 'root', revisionId, label: 'the org board' }}
        childKind={addKind}
      />
    </>
  )
}

/**
 * Zero-state before any revision exists (fresh prod DB, or a wipe).
 * Spins up a blank revision so the admin can start building.
 */
function NoRevisionPrimer() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function create() {
    startTransition(async () => {
      try {
        await createBlankOrgBoardRevisionAction()
        toast.success('Blank revision created')
        router.refresh()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to create revision',
        )
      }
    })
  }

  return (
    <EmptyState
      icon={Network}
      tone="brand"
      title="No org board yet"
      description="Create a blank revision to start building your org chart."
    >
      <Button onClick={create} disabled={pending}>
        {pending ? (
          <Loader2 className="mr-1.5 size-4 animate-spin" />
        ) : (
          <Plus className="mr-1.5 size-4" />
        )}
        Create org board
      </Button>
    </EmptyState>
  )
}

function EmptyBoardPrimer({ revisionId }: { revisionId: string }) {
  const [addKind, setAddKind] = useState<OrgNodeKindValue | null>(null)
  return (
    <>
      <EmptyState
        icon={Network}
        tone="brand"
        title="No nodes yet"
        description="Start by adding a role or a division."
      >
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => setAddKind('CROWN')}>Add role</Button>
          <Button variant="outline" onClick={() => setAddKind('DIVISION')}>
            Add division
          </Button>
        </div>
      </EmptyState>

      <OrgNodeAddDialog
        open={addKind !== null}
        onOpenChange={(v) => !v && setAddKind(null)}
        target={{
          mode: 'root',
          revisionId,
          label: addKind === 'DIVISION' ? 'the org board' : 'the org board',
        }}
        childKind={addKind}
      />
    </>
  )
}

function ViewSwitcher({ nodes }: { nodes: OrgNodeRow[] }) {
  // Persist the last chosen view between reloads. Not critical
  // enough for URL state — localStorage is fine. We always start
  // at 'classic' so server-rendered and first-client-render HTML
  // match; the stored value is applied in a mount effect below to
  // avoid React #418 hydration warnings.
  const [view, setView] = useState<'classic' | 'chart'>('classic')
  const [drawerNodeId, setDrawerNodeId] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('orgBoardView')
    if (stored === 'classic' || stored === 'chart') {
      setView(stored)
    }
  }, [])

  function updateView(next: 'classic' | 'chart') {
    setView(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem('orgBoardView', next)
    }
  }

  const drawerNode = drawerNodeId
    ? nodes.find((n) => n.id === drawerNodeId) ?? null
    : null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Tabs value={view} onValueChange={(v) => updateView(v as 'classic' | 'chart')}>
          <TabsList>
            <TabsTrigger value="classic">Classic</TabsTrigger>
            <TabsTrigger value="chart">Chart</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === 'classic' ? (
        <FilterableChart nodes={nodes} />
      ) : (
        <OrgFlowChart
          nodes={nodes}
          onNodeClick={(id) => setDrawerNodeId(id)}
        />
      )}

      <OrgNodeDrawer
        node={drawerNode}
        open={drawerNodeId !== null}
        onOpenChange={(v) => {
          if (!v) setDrawerNodeId(null)
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------
// Recent activity strip
// ---------------------------------------------------------------------

function RecentActivity({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <details className="rounded-xl border bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold hover:bg-muted/40">
        Recent activity <span className="text-xs text-muted-foreground">({entries.length})</span>
      </summary>
      <ul className="divide-y border-t">
        {entries.slice(0, 20).map((e) => (
          <li key={e.id} className="flex items-start gap-3 px-4 py-2 text-sm">
            <span className="mt-0.5 shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
              {e.action.replace(/_/g, ' ').toLowerCase()}
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate">
                {e.actor?.name ?? e.actor?.email ?? 'system'}{' '}
                <span className="text-muted-foreground">·{' '}
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </p>
              <ActivitySummary entry={e} />
            </div>
          </li>
        ))}
      </ul>
    </details>
  )
}

/** Labels a raw snapshot key for the activity feed. Anything not in
 *  this map is skipped (id/orderIndex churn isn't useful to surface). */
const AUDIT_FIELD_LABELS: Record<string, string> = {
  label: 'Name',
  positionTitle: 'Title',
  parentId: 'Parent',
  employeeId: 'Employee',
  freeTextHolder: 'Placeholder',
  color: 'Color',
  functionText: 'Function',
  kind: 'Kind',
}

function truncate(value: unknown, max = 40): string {
  if (value === null || value === undefined || value === '') return '∅'
  const str = String(value)
  return str.length > max ? `${str.slice(0, max - 1)}…` : str
}

function ActivitySummary({ entry }: { entry: AuditLogEntry }) {
  const oldObj =
    entry.oldValue && typeof entry.oldValue === 'object'
      ? (entry.oldValue as Record<string, unknown>)
      : null
  const newObj =
    entry.newValue && typeof entry.newValue === 'object'
      ? (entry.newValue as Record<string, unknown>)
      : null

  // NODE_CREATED / NODE_DELETED: show the affected node's label
  if (entry.action === 'NODE_CREATED' && newObj?.label) {
    return (
      <p className="truncate text-xs text-muted-foreground">
        Added <span className="font-medium text-foreground">{String(newObj.label)}</span>
      </p>
    )
  }
  if (entry.action === 'NODE_DELETED' && oldObj?.label) {
    return (
      <p className="truncate text-xs text-muted-foreground">
        Removed <span className="font-medium text-foreground">{String(oldObj.label)}</span>
      </p>
    )
  }

  // NODE_UPDATED: diff the interesting fields
  if (oldObj && newObj) {
    const changes: Array<{ field: string; from: unknown; to: unknown }> = []
    for (const [key, label] of Object.entries(AUDIT_FIELD_LABELS)) {
      if (!(key in oldObj) && !(key in newObj)) continue
      const from = oldObj[key]
      const to = newObj[key]
      if (from !== to) changes.push({ field: label, from, to })
    }
    if (changes.length === 0) return null
    return (
      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {changes.slice(0, 3).map((c, i) => (
          <li key={i} className="truncate">
            <span className="font-medium text-foreground">{c.field}:</span>{' '}
            <span className="line-through opacity-60">{truncate(c.from)}</span>{' '}
            → <span className="text-foreground">{truncate(c.to)}</span>
          </li>
        ))}
        {changes.length > 3 ? (
          <li className="italic">…and {changes.length - 3} more</li>
        ) : null}
      </ul>
    )
  }

  return null
}

// ---------------------------------------------------------------------
// Filter panel — search text, kind filter, vacancy toggle. Dims
// non-matching nodes rather than hiding them, so the tree shape
// stays visible.
// ---------------------------------------------------------------------

function FilterableChart({ nodes }: { nodes: OrgNodeRow[] }) {
  const [query, setQuery] = useState('')
  const [vacantOnly, setVacantOnly] = useState(false)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q && !vacantOnly) return null // null = "everything visible"
    const acc = new Set<string>()
    for (const n of nodes) {
      const isVacant =
        n.kind === 'POSITION' &&
        n.holder.kind === 'unassigned' &&
        n.activeAssignmentsCount === 0
      const holderText =
        n.holder.kind === 'employee'
          ? n.holder.employee.name
          : n.holder.kind === 'placeholder'
            ? n.holder.label
            : ''
      const textMatch =
        !q ||
        n.label.toLowerCase().includes(q) ||
        (n.positionTitle ?? '').toLowerCase().includes(q) ||
        holderText.toLowerCase().includes(q)
      const vacantMatch = !vacantOnly || isVacant
      if (textMatch && vacantMatch) acc.add(n.id)
    }
    return acc
  }, [query, vacantOnly, nodes])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search label, role, holder…"
            className="pl-9"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 rounded border-input"
            checked={vacantOnly}
            onChange={(e) => setVacantOnly(e.target.checked)}
          />
          Vacant only
        </label>
      </div>
      {matches && matches.size === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description={
            vacantOnly
              ? 'No nodes match this search + vacancy filter.'
              : 'No nodes match this search.'
          }
        >
          <Button
            variant="outline"
            onClick={() => {
              setQuery('')
              setVacantOnly(false)
            }}
          >
            Clear filters
          </Button>
        </EmptyState>
      ) : (
        <TopLevelChart nodes={nodes} matchIds={matches} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Top-level view — crown chain + 7 divisions
// ---------------------------------------------------------------------

function TopLevelChart({
  nodes,
  matchIds,
}: {
  nodes: OrgNodeRow[]
  /** null = filter inactive; otherwise contains the set of node
   *  ids that pass the filter. Non-matching nodes get dimmed. */
  matchIds?: Set<string> | null
}) {
  function dimClass(nodeId: string): string {
    if (!matchIds) return ''
    return matchIds.has(nodeId) ? '' : 'opacity-25'
  }
  const { crown, divisions, byParent } = useMemo(() => {
    const crown = nodes
      .filter((n) => n.kind === 'CROWN')
      .sort((a, b) => a.orderIndex - b.orderIndex)
    const divisions = nodes
      .filter((n) => n.kind === 'DIVISION')
      .sort((a, b) => a.orderIndex - b.orderIndex)

    // Index children by parentId for O(1) lookup while rendering.
    const byParent = new Map<string, OrgNodeRow[]>()
    for (const n of nodes) {
      if (!n.parentId) continue
      const list = byParent.get(n.parentId) ?? []
      list.push(n)
      byParent.set(n.parentId, list)
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => a.orderIndex - b.orderIndex)
    }

    return { crown, divisions, byParent }
  }, [nodes])

  const onlyOne = divisions.length === 1
  return (
    <div className="overflow-x-auto">
      {/* Single vertical stack with NO row gaps — each connector
          segment (h-4) physically touches the cards above and below
          it. Any outer `space-y-*` between the crown chain and the
          divisions row would leave a floating chunk mid-line, so we
          manage the whole chart's internal spacing here. */}
      <div className="flex flex-col items-stretch">
        {/* Crown chain */}
        {crown.length > 0 ? (
          <div className="flex justify-center">
            <div className="flex flex-col items-center">
              {crown.map((c, i) => (
                <div
                  key={c.id}
                  className={cn(
                    'flex flex-col items-center transition-opacity',
                    dimClass(c.id),
                  )}
                >
                  {i > 0 ? (
                    <span className="h-4 w-px bg-zinc-400 dark:bg-zinc-500" />
                  ) : null}
                  <CrownCard node={c} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {divisions.length > 0 ? (
          <>
            {/* Vertical stub — sits flush against the last crown card
                if any, or acts as a decorative header stub otherwise. */}
            {crown.length > 0 ? (
              <div className="mx-auto h-4 w-px bg-zinc-400 dark:bg-zinc-500" />
            ) : null}

            {/* Branch row — one cell per division with an optional
                horizontal top-line + a centred vertical drop. */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${divisions.length}, minmax(180px, 1fr))`,
              }}
            >
              {divisions.map((_, i) => {
                const isFirst = i === 0
                const isLast = i === divisions.length - 1
                return (
                  <div key={i} className="relative flex justify-center">
                    {/* Horizontal segment across the top of the cell.
                        First cell: right half only. Last cell: left
                        half only. Middle cells: full width. */}
                    {!onlyOne ? (
                      <span
                        className={cn(
                          'pointer-events-none absolute top-0 h-px bg-zinc-400 dark:bg-zinc-500',
                          isFirst
                            ? 'left-1/2 right-0'
                            : isLast
                              ? 'left-0 right-1/2'
                              : 'left-0 right-0',
                        )}
                      />
                    ) : null}
                    {/* Vertical drop into the division column below. */}
                    <span className="h-4 w-px bg-zinc-400 dark:bg-zinc-500" />
                  </div>
                )
              })}
            </div>

            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${divisions.length}, minmax(180px, 1fr))`,
              }}
            >
              {divisions.map((div) => (
                <div
                  key={div.id}
                  className={cn('transition-opacity', dimClass(div.id))}
                >
                  <DivisionColumn node={div} depts={byParent.get(div.id) ?? []} />
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

    </div>
  )
}

function CrownCard({ node }: { node: OrgNodeRow }) {
  return (
    <div
      className={cn(
        'w-[220px] overflow-hidden rounded-md shadow-sm ring-1',
        CROWN_STYLE.bg,
        CROWN_STYLE.text,
        CROWN_STYLE.ring,
      )}
    >
      <div className="border-b border-white/20 px-3 py-2 text-center text-sm font-semibold">
        {node.label}
      </div>
      <div className="flex items-center justify-between gap-2 bg-white/10 px-3 py-2 text-sm">
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          <span className="truncate">
            <HolderText holder={node.holder} />
          </span>
          <AssignmentBadge count={node.activeAssignmentsCount} />
        </span>
        <OrgNodeMenu node={node} layout="row" triggerClassName="text-white" />
      </div>
    </div>
  )
}

function DivisionColumn({
  node,
  depts,
}: {
  node: OrgNodeRow
  depts: OrgNodeRow[]
}) {
  const style =
    DIVISION_COLORS[node.color ?? 'blue'] ?? DIVISION_COLORS.blue!

  return (
    <div className="flex flex-col overflow-hidden rounded-md shadow-sm">
      {/* Division header + director */}
      <div className={cn('relative px-3 py-2 text-center', style.bg, style.text)}>
        <div className="absolute right-1 top-1">
          <OrgNodeMenu node={node} layout="column" triggerClassName="text-white" />
        </div>
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide">
          {node.label}
        </p>
        {node.positionTitle ? (
          <div className="mt-2 rounded bg-black/20 px-2 py-1 text-xs font-medium">
            <p className="truncate">{node.positionTitle}</p>
            <p className="flex items-center justify-center gap-1.5 truncate text-[11px] opacity-80">
              <span className="truncate">
                <HolderText holder={node.holder} />
              </span>
              <AssignmentBadge count={node.activeAssignmentsCount} />
            </p>
          </div>
        ) : null}
      </div>

      {/* Departments stacked in the column body */}
      <div
        className={cn('flex-1 space-y-3 px-3 py-3 text-white', style.bg)}
      >
        {depts.length === 0 ? (
          <p className="text-center text-xs italic opacity-70">
            No departments yet
          </p>
        ) : (
          depts.map((dept) => (
            <DepartmentBlock key={dept.id} node={dept} />
          ))
        )}
      </div>

    </div>
  )
}

function DepartmentBlock({ node }: { node: OrgNodeRow }) {
  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/admin/org-board/nodes/${node.id}`}
          className="block flex-1 text-[11px] font-semibold leading-snug hover:underline"
        >
          {node.label}
        </Link>
        <OrgNodeMenu node={node} layout="row" triggerClassName="text-white" />
      </div>
      {node.positionTitle ? (
        <p className="text-[11px] opacity-90">{node.positionTitle}</p>
      ) : null}
      {node.holder.kind !== 'unassigned' ? (
        <p className="flex items-center gap-1.5 text-[11px] opacity-70">
          <span className="truncate">
            <HolderText holder={node.holder} />
          </span>
          <AssignmentBadge count={node.activeAssignmentsCount} />
        </p>
      ) : null}
    </div>
  )
}

