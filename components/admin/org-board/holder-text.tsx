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
