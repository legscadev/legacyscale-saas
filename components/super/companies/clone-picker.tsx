'use client'

import { AlertTriangle } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

/** Every clonable axis — shared between the create-with-clone form
 *  and the row-level Clone dialog so both surfaces stay in sync. */
export interface CloneFlags {
  memberships: boolean
  courses: boolean
  trainings: boolean
  statistics: boolean
  orgBoard: boolean
  onboardingChecklists: boolean
  members: boolean
  team: boolean
}

export const CLONE_FLAGS_DEFAULT: CloneFlags = {
  memberships: true,
  courses: true,
  trainings: false,
  statistics: false,
  orgBoard: false,
  onboardingChecklists: false,
  members: false,
  team: false,
}

export function anyCloneFlagSet(flags: CloneFlags): boolean {
  return Object.values(flags).some(Boolean)
}

interface ClonePickerProps {
  flags: CloneFlags
  onChange: (next: CloneFlags) => void
  disabled?: boolean
  /** Optional prefix so the checkbox ids stay unique when the picker
   *  is used more than once on a single page (e.g. row-level dialogs
   *  each opened with the same table showing behind). */
  idPrefix?: string
}

interface Row {
  key: keyof CloneFlags
  label: string
  description: string
  destructive?: boolean
}

const TEMPLATE_ROWS: Row[] = [
  {
    key: 'memberships',
    label: 'Membership',
    description:
      'Membership tier names, slugs, and descriptions. Course → membership links are re-mapped.',
  },
  {
    key: 'courses',
    label: 'Courses',
    description:
      'Member-facing courses (audience MEMBERS or BOTH), including modules, chapters, lessons, quiz questions, and lesson-resource metadata. All copied as DRAFT.',
  },
  {
    key: 'trainings',
    label: 'Trainings',
    description:
      'Internal-team trainings (audience INTERNAL or BOTH), same cascade as courses. BOTH-audience content ticks both boxes but only copies once.',
  },
  {
    key: 'statistics',
    label: 'Statistics',
    description:
      'Divisions + metric definitions. Recorded data points stay on the source — those are per-tenant history, not template.',
  },
  {
    key: 'orgBoard',
    label: 'Org board',
    description:
      'Revisions, node tree, and position details. Employee assignments unbind on clone (positions clone empty).',
  },
  {
    key: 'onboardingChecklists',
    label: 'Onboarding checklists',
    description:
      'Checklist item templates only. Per-employee status rows never clone.',
  },
]

const PEOPLE_ROWS: Row[] = [
  {
    key: 'members',
    label: 'Members',
    description:
      'Adds every MEMBER-role user from the source tenant to this tenant. Real people gain access on next login.',
    destructive: true,
  },
  {
    key: 'team',
    label: 'Team',
    description:
      'Adds every TEAM + ADMIN user from the source. OWNER seats never copy — ownership is per-tenant.',
    destructive: true,
  },
]

export function ClonePicker({
  flags,
  onChange,
  disabled = false,
  idPrefix = 'clone',
}: ClonePickerProps) {
  const set = (key: keyof CloneFlags, v: boolean) =>
    onChange({ ...flags, [key]: v })

  const hasAny = anyCloneFlagSet(flags)

  return (
    <div className="space-y-3 rounded-md border border-dashed p-3">
      <p className="text-xs font-medium text-muted-foreground">What to copy</p>

      <Group label="Templates" rows={TEMPLATE_ROWS}>
        {TEMPLATE_ROWS.map((row) => (
          <CloneRow
            key={row.key}
            id={`${idPrefix}-${row.key}`}
            label={row.label}
            description={row.description}
            checked={flags[row.key]}
            onCheckedChange={(v) => set(row.key, v)}
            disabled={disabled}
          />
        ))}
      </Group>

      <Group
        label="People"
        rows={PEOPLE_ROWS}
        note="Real users. Anyone you add will see this tenant on next sign-in."
      >
        {PEOPLE_ROWS.map((row) => (
          <CloneRow
            key={row.key}
            id={`${idPrefix}-${row.key}`}
            label={row.label}
            description={row.description}
            checked={flags[row.key]}
            onCheckedChange={(v) => set(row.key, v)}
            disabled={disabled}
            destructive
          />
        ))}
      </Group>

      {!hasAny ? (
        <p className="text-xs text-destructive">
          Pick at least one — otherwise the clone is a no-op.
        </p>
      ) : null}
    </div>
  )
}

interface GroupProps {
  label: string
  rows: Row[]
  note?: string
  children: React.ReactNode
}

function Group({ label, note, children }: GroupProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {note ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
            <AlertTriangle className="size-3" />
            {note}
          </span>
        ) : null}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

interface CloneRowProps {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
  destructive?: boolean
}

function CloneRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  destructive,
}: CloneRowProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer select-none items-start gap-3 rounded-md p-2 transition-colors hover:bg-muted/40',
        checked && destructive && 'bg-amber-500/[0.06]',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="space-y-0.5">
        <p className="text-sm font-medium leading-none">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </label>
  )
}

/**
 * Format a snapshot summary as a compact human-readable string —
 * used by toasts to narrate what actually copied. Zero counts are
 * suppressed so a "just categories" clone doesn't read "0 courses,
 * 0 trainings, 0 …".
 */
export function summarizeSnapshot(summary: {
  membershipsCopied: number
  coursesCopied: number
  trainingsCopied: number
  lessonsCopied: number
  quizQuestionsCopied: number
  statMetricsCopied: number
  orgNodesCopied: number
  onboardingItemsCopied: number
  membersCopied: number
  teamCopied: number
}): string {
  const parts: string[] = []
  if (summary.membershipsCopied) parts.push(`${summary.membershipsCopied} memberships`)
  if (summary.coursesCopied) parts.push(`${summary.coursesCopied} courses`)
  if (summary.trainingsCopied) parts.push(`${summary.trainingsCopied} trainings`)
  if (summary.lessonsCopied) parts.push(`${summary.lessonsCopied} lessons`)
  if (summary.quizQuestionsCopied)
    parts.push(`${summary.quizQuestionsCopied} quiz questions`)
  if (summary.statMetricsCopied)
    parts.push(`${summary.statMetricsCopied} stat metrics`)
  if (summary.orgNodesCopied) parts.push(`${summary.orgNodesCopied} org nodes`)
  if (summary.onboardingItemsCopied)
    parts.push(`${summary.onboardingItemsCopied} onboarding items`)
  if (summary.membersCopied) parts.push(`${summary.membersCopied} members`)
  if (summary.teamCopied) parts.push(`${summary.teamCopied} team users`)
  return parts.length > 0 ? parts.join(', ') : 'nothing'
}
