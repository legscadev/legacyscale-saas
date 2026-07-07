import type { OrgNodeHolder } from '@/lib/services/org-board-service'

interface HolderTextProps {
  holder: OrgNodeHolder
  /** Optional class applied to the italic "Unassigned" fallback so
   *  colored cards can tone it down (e.g. `opacity-70`). */
  unassignedClassName?: string
}

/**
 * Renders whoever holds an org node's seat: a real employee's name, a
 * free-text placeholder, or an italic "Unassigned" fallback. Replaces
 * the copy-pasted `node.employee?.name || node.freeTextHolder || …`
 * ladder that used to live in every card variant.
 */
export function HolderText({
  holder,
  unassignedClassName = 'italic opacity-70',
}: HolderTextProps) {
  switch (holder.kind) {
    case 'employee':
      return <>{holder.employee.name}</>
    case 'placeholder':
      return <>{holder.label}</>
    case 'unassigned':
      return <span className={unassignedClassName}>Unassigned</span>
  }
}

interface AssignmentBadgeProps {
  count: number
  className?: string
}

/**
 * "+N" chip that appears next to the primary holder when a node has
 * multiple active position_assignments. Renders nothing when there's
 * one or zero — that's the "no additional holders" state. */
export function AssignmentBadge({
  count,
  className = 'bg-white/25 text-[10px] font-semibold',
}: AssignmentBadgeProps) {
  if (count <= 1) return null
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 ${className}`}
      title={`${count} people currently assigned`}
    >
      +{count - 1}
    </span>
  )
}
