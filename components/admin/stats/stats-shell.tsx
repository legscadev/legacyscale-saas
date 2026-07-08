'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, MoreVertical, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState, PageHeader } from '@/components/shared'
import { deleteDivisionAction } from '@/app/(admin)/admin/stats/actions'
import { DivisionDialog } from './division-dialog'
import { MetricDialog } from './metric-dialog'
import { MetricCard } from './metric-card'
import type {
  AssigneePickerOption,
} from '@/app/(admin)/admin/stats/actions'
import type {
  StatDivisionSummary,
  StatMetricRow,
} from '@/lib/services/stat-tracker-service'

const ALL_GROUPS = '__all__'

interface StatsShellProps {
  currentUserId: string
  currentUserIsAdmin: boolean
  divisions: StatDivisionSummary[]
  /** Group from ?division=… — used as the initial selection but
   *  otherwise driven by client state. Null / missing = "all". */
  initialDivisionId: string | null
  metrics: StatMetricRow[]
  assignees: AssigneePickerOption[]
}

export function StatsShell({
  currentUserId,
  currentUserIsAdmin,
  divisions,
  initialDivisionId,
  metrics,
  assignees,
}: StatsShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    initialDivisionId && divisions.some((d) => d.id === initialDivisionId)
      ? initialDivisionId
      : ALL_GROUPS,
  )
  const [search, setSearch] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  // Default the date range to today on both sides so the board opens
  // showing "what got recorded today." Users can widen with a preset
  // chip or a manual From/To pick.
  const [fromDate, setFromDate] = useState<string>(() => toIsoDate(new Date()))
  const [toDate, setToDate] = useState<string>(() => toIsoDate(new Date()))
  const [creatingDivision, setCreatingDivision] = useState(false)
  const [editingDivision, setEditingDivision] = useState(false)
  const [creatingMetric, setCreatingMetric] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, startDelete] = useTransition()

  const activeDivision =
    selectedGroupId === ALL_GROUPS
      ? null
      : (divisions.find((d) => d.id === selectedGroupId) ?? null)

  // Which preset (if any) exactly matches the current from/to
  // values. Powers the "active" highlight on the chip. Custom
  // ranges leave every chip inactive.
  const activePreset = matchPreset(fromDate, toDate)
  const rangeLabel = presetLabel(activePreset, fromDate, toDate)

  function applyToday() {
    const today = toIsoDate(new Date())
    setFromDate(today)
    setToDate(today)
  }

  function applyRangePreset(days: number) {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - days + 1)
    setFromDate(toIsoDate(from))
    setToDate(toIsoDate(to))
  }

  function applyYtdPreset() {
    const now = new Date()
    setFromDate(`${now.getFullYear()}-01-01`)
    setToDate(toIsoDate(now))
  }

  function selectGroup(id: string) {
    setSelectedGroupId(id)
    // Keep the URL in sync so refreshes + deep-links land on the
    // same view. `?division=…` stays; "all" strips it.
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    if (id === ALL_GROUPS) params.delete('division')
    else params.set('division', id)
    const qs = params.toString()
    router.replace(qs ? `/admin/stats?${qs}` : '/admin/stats')
  }

  // ─── DERIVED ────────────────────────────────────────────────
  const totals = useMemo(() => {
    // Scope the "mine" count to the currently selected group so the
    // number next to the "Only mine" toggle always matches what the
    // user is looking at. Metrics stays a global count so the
    // "shown of total" header still tells the truth.
    const scoped =
      selectedGroupId === ALL_GROUPS
        ? metrics
        : metrics.filter((m) => m.division.id === selectedGroupId)
    const mine = scoped.filter(
      (m) => m.assignedTo?.id === currentUserId,
    ).length
    const withValues = metrics.filter((m) => m.dataPoints.length > 0).length
    return {
      groups: divisions.length,
      metrics: metrics.length,
      mine,
      withValues,
    }
  }, [metrics, divisions, currentUserId, selectedGroupId])

  const filteredMetrics = useMemo(() => {
    const q = search.trim().toLowerCase()
    return metrics.filter((m) => {
      if (
        selectedGroupId !== ALL_GROUPS &&
        m.division.id !== selectedGroupId
      ) {
        return false
      }
      if (onlyMine && m.assignedTo?.id !== currentUserId) return false
      if (q) {
        const hay = `${m.name} ${m.description ?? ''} ${m.division.name}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [metrics, selectedGroupId, onlyMine, search, currentUserId])

  // ─── DELETE HANDLER ─────────────────────────────────────────
  function handleDeleteDivision() {
    if (!activeDivision) return
    startDelete(async () => {
      const result = await deleteDivisionAction(activeDivision.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Group deleted')
      setConfirmingDelete(false)
      // Fall back to All groups after delete.
      selectGroup(ALL_GROUPS)
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statistics"
        description="Track the KPIs that keep every team accountable — one board for every group and metric."
      >
        <div className="flex flex-wrap items-center gap-2">
          {divisions.length > 0 ? (
            <GroupPicker
              divisions={divisions}
              value={selectedGroupId}
              onChange={selectGroup}
              totalMetrics={metrics.length}
            />
          ) : null}
          {currentUserIsAdmin ? (
            <Button onClick={() => setCreatingDivision(true)}>
              <Plus />
              New group
            </Button>
          ) : null}
        </div>
      </PageHeader>

      {divisions.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No groups yet"
          description="Create your first group to start tracking metrics."
        />
      ) : (
        <div className="space-y-4">
            {/* Filter bar */}
            <div className="space-y-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={
                      selectedGroupId === ALL_GROUPS
                        ? 'Search across all metrics…'
                        : 'Search metrics in this group…'
                    }
                    className="pl-9"
                  />
                </div>
                <label
                  htmlFor="stats-only-mine"
                  className="flex shrink-0 items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm"
                >
                  <input
                    id="stats-only-mine"
                    type="checkbox"
                    checked={onlyMine}
                    onChange={(e) => setOnlyMine(e.target.checked)}
                    className="size-4 rounded border-input"
                  />
                  <span>Only mine</span>
                  <span className="text-xs text-muted-foreground">
                    ({totals.mine})
                  </span>
                </label>
              </div>

              {/* Date range — filters every card's chart + latest
                  value to the selected window. Empty inputs = no
                  bound; the quick presets set both sides at once. */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Date range:</span>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  aria-label="From date"
                  className="h-8 w-auto"
                />
                <span className="text-muted-foreground">→</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  aria-label="To date"
                  className="h-8 w-auto"
                />
                <div className="flex items-center gap-1">
                  <DateRangeChip
                    label="Today"
                    active={activePreset === 'today'}
                    onClick={applyToday}
                  />
                  <DateRangeChip
                    label="7d"
                    active={activePreset === '7d'}
                    onClick={() => applyRangePreset(7)}
                  />
                  <DateRangeChip
                    label="30d"
                    active={activePreset === '30d'}
                    onClick={() => applyRangePreset(30)}
                  />
                  <DateRangeChip
                    label="90d"
                    active={activePreset === '90d'}
                    onClick={() => applyRangePreset(90)}
                  />
                  <DateRangeChip
                    label="YTD"
                    active={activePreset === 'ytd'}
                    onClick={() => applyYtdPreset()}
                  />
                  {fromDate || toDate ? (
                    <DateRangeChip
                      label="Clear"
                      onClick={() => {
                        setFromDate('')
                        setToDate('')
                      }}
                    />
                  ) : null}
                </div>
              </div>
            </div>

            {/* Group section header — only when a specific group
                is selected. Shows description, New-metric CTA, and
                the Edit/Delete kebab. */}
            {activeDivision ? (
              <div className="flex items-start justify-between gap-4 border-b pb-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold tracking-tight">
                    {activeDivision.shortLabel
                      ? `${activeDivision.shortLabel} — ${activeDivision.name}`
                      : activeDivision.name}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {activeDivision.description ??
                      `${activeDivision.metricCount} ${activeDivision.metricCount === 1 ? 'metric' : 'metrics'}`}
                  </p>
                </div>
                {currentUserIsAdmin ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button onClick={() => setCreatingMetric(true)}>
                      <Plus />
                      New metric
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label="Group actions"
                        render={
                          <button
                            type="button"
                            className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          />
                        }
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-auto min-w-40">
                        <DropdownMenuItem onClick={() => setEditingDivision(true)}>
                          <Pencil className="size-4" />
                          Edit group
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setConfirmingDelete(true)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-4" />
                          Delete group
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    All metrics
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {filteredMetrics.length} of {totals.metrics} shown
                  </p>
                </div>
                {currentUserIsAdmin ? (
                  <Button onClick={() => setCreatingMetric(true)}>
                    <Plus />
                    New metric
                  </Button>
                ) : null}
              </div>
            )}

          {/* Grid */}
          {filteredMetrics.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title={
                metrics.length === 0
                  ? 'No metrics yet'
                  : 'No metrics match your filters'
              }
              description={
                metrics.length === 0
                  ? currentUserIsAdmin
                    ? 'Click "New metric" to add your first KPI card.'
                    : 'An admin needs to add metrics before values can be recorded.'
                  : 'Clear the search or "Only mine" filter to widen the view.'
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredMetrics.map((m) => (
                <MetricCard
                  key={m.id}
                  metric={m}
                  currentUserId={currentUserId}
                  currentUserIsAdmin={currentUserIsAdmin}
                  divisions={divisions}
                  assignees={assignees}
                  showGroupBadge={selectedGroupId === ALL_GROUPS}
                  fromDate={fromDate || null}
                  toDate={toDate || null}
                  rangeLabel={rangeLabel}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* DIALOGS ────────────────────────────────────────────── */}
      <DivisionDialog
        open={creatingDivision}
        onOpenChange={setCreatingDivision}
        onCreated={(id) => selectGroup(id)}
      />
      {activeDivision ? (
        <DivisionDialog
          open={editingDivision}
          onOpenChange={setEditingDivision}
          initial={{
            id: activeDivision.id,
            name: activeDivision.name,
            shortLabel: activeDivision.shortLabel,
            description: activeDivision.description,
          }}
        />
      ) : null}
      <MetricDialog
        open={creatingMetric}
        onOpenChange={setCreatingMetric}
        divisions={divisions}
        assignees={assignees}
        defaultDivisionId={
          selectedGroupId === ALL_GROUPS ? null : selectedGroupId
        }
      />

      <AlertDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {activeDivision?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the group, every metric under it, and
              every recorded value on those metrics. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDivision}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete group'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface GroupPickerProps {
  divisions: StatDivisionSummary[]
  value: string
  onChange: (id: string) => void
  totalMetrics: number
}

/** Header-inline picker: "All groups" at the top, then each group
 *  with its metric count. Matches how the sidebar rail behaved but
 *  in a compact dropdown. */
function GroupPicker({
  divisions,
  value,
  onChange,
  totalMetrics,
}: GroupPickerProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v)
      }}
    >
      <SelectTrigger aria-label="Group" className="w-full sm:w-72">
        <SelectValue placeholder="Choose a group">
          {(v: string) => {
            if (v === ALL_GROUPS) {
              return (
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="truncate">All groups</span>
                  <span className="shrink-0 rounded bg-muted-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-muted-foreground">
                    {totalMetrics}
                  </span>
                </span>
              )
            }
            const d = divisions.find((x) => x.id === v)
            if (!d) return 'Choose a group'
            const label = d.shortLabel
              ? `${d.shortLabel} — ${d.name}`
              : d.name
            return (
              <span className="flex w-full items-center justify-between gap-3">
                <span className="truncate">{label}</span>
                <span className="shrink-0 rounded bg-muted-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-muted-foreground">
                  {d.metricCount}
                </span>
              </span>
            )
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_GROUPS}>
          <span className="flex w-full items-center justify-between gap-3">
            <span>All groups</span>
            <span className="shrink-0 rounded bg-muted-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-muted-foreground">
              {totalMetrics}
            </span>
          </span>
        </SelectItem>
        {divisions.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            <span className="flex w-full items-center justify-between gap-3">
              <span className="truncate">
                {d.shortLabel ? `${d.shortLabel} — ${d.name}` : d.name}
              </span>
              <span className="shrink-0 rounded bg-muted-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-muted-foreground">
                {d.metricCount}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface DateRangeChipProps {
  label: string
  onClick: () => void
  active?: boolean
}

function DateRangeChip({ label, onClick, active = false }: DateRangeChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ' +
        (active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground')
      }
    >
      {label}
    </button>
  )
}

type PresetKey = 'today' | '7d' | '30d' | '90d' | 'ytd' | null

/**
 * Detect which preset the given (from, to) pair encodes. Returns
 * null for empty or custom ranges. The check is date-string
 * equality so timezone drift can't cause false negatives.
 */
function matchPreset(fromDate: string, toDate: string): PresetKey {
  if (!fromDate || !toDate) return null
  const today = toIsoDate(new Date())
  if (fromDate === today && toDate === today) return 'today'

  const ytdFrom = `${new Date().getFullYear()}-01-01`
  if (fromDate === ytdFrom && toDate === today) return 'ytd'

  const daysBack = (days: number): string => {
    const d = new Date()
    d.setDate(d.getDate() - days + 1)
    return toIsoDate(d)
  }
  if (toDate === today && fromDate === daysBack(7)) return '7d'
  if (toDate === today && fromDate === daysBack(30)) return '30d'
  if (toDate === today && fromDate === daysBack(90)) return '90d'
  return null
}

/**
 * Human label for the currently selected range. Rendered next to
 * the card's latest value so the reader can tell what window the
 * value represents. `null` when no filter is applied.
 */
function presetLabel(
  preset: PresetKey,
  fromDate: string,
  toDate: string,
): string | null {
  if (preset === 'today') return 'today'
  if (preset === '7d') return 'past 7 days'
  if (preset === '30d') return 'past 30 days'
  if (preset === '90d') return 'past 90 days'
  if (preset === 'ytd') return 'year to date'
  // Custom range — anchor the label on the TO date so the user
  // sees where the window ends. Single-day picks read as just
  // that date; wider spans read as "through Jul 15".
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso + 'T00:00:00'))
  if (fromDate && toDate) {
    return fromDate === toDate ? fmt(toDate) : `through ${fmt(toDate)}`
  }
  if (toDate) return `through ${fmt(toDate)}`
  if (fromDate) return `since ${fmt(fromDate)}`
  return null
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
