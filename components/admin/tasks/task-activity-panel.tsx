// Activity timeline for the task detail drawer. Renders the
// immutable audit log written by every mutation service in Phase
// 1.6. Server-side truth — this panel is read-only; new events
// arrive via the drawer's onChanged → refetch loop.
//
// Verb rendering is intentionally terse. When from/to snapshots
// name a status or user id we can resolve, we surface the name;
// otherwise we fall back to a generic sentence. Future phases can
// expand the renderer without touching the service layer.

import { formatDistanceToNow } from 'date-fns'
import {
  Archive,
  ArchiveRestore,
  Calendar,
  CheckSquare,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Tag,
  Trash2,
  UserPlus,
  UserX,
  type LucideIcon,
} from 'lucide-react'

import type {
  TaskActivityAction,
  TaskActivityRow,
} from '@/lib/services/task-activity-service'
import { TASK_PRIORITY_LABELS } from '@/lib/validations/tasks'

interface TaskActivityPanelProps {
  activity: TaskActivityRow[]
  statusNameById: Map<string, string>
  categoryNameById: Map<string, string>
  labelNameById: Map<string, string>
  memberNameById: Map<string, string>
}

const ICONS: Record<TaskActivityAction, LucideIcon> = {
  created: Plus,
  updated: Pencil,
  status_changed: CheckSquare,
  priority_changed: CheckSquare,
  assigned: UserPlus,
  unassigned: UserX,
  watcher_added: UserPlus,
  watcher_removed: UserX,
  labels_changed: Tag,
  category_changed: Tag,
  due_date_changed: Calendar,
  archived: Archive,
  restored: ArchiveRestore,
  deleted: Trash2,
  comment_added: MessageSquare,
  comment_edited: MessageSquare,
  comment_deleted: MessageSquare,
  checklist_added: CheckSquare,
  checklist_deleted: CheckSquare,
  checklist_item_added: CheckSquare,
  checklist_item_toggled: CheckSquare,
  checklist_item_deleted: CheckSquare,
  attachment_added: Paperclip,
  attachment_removed: Paperclip,
}

export function TaskActivityPanel({
  activity,
  statusNameById,
  categoryNameById,
  labelNameById,
  memberNameById,
}: TaskActivityPanelProps) {
  if (activity.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
        No activity yet.
      </p>
    )
  }

  return (
    <ol className="space-y-2">
      {activity.map((row) => (
        <ActivityEntry
          key={row.id}
          row={row}
          statusNameById={statusNameById}
          categoryNameById={categoryNameById}
          labelNameById={labelNameById}
          memberNameById={memberNameById}
        />
      ))}
    </ol>
  )
}

interface ActivityEntryProps {
  row: TaskActivityRow
  statusNameById: Map<string, string>
  categoryNameById: Map<string, string>
  labelNameById: Map<string, string>
  memberNameById: Map<string, string>
}

function ActivityEntry({
  row,
  statusNameById,
  categoryNameById,
  labelNameById,
  memberNameById,
}: ActivityEntryProps) {
  const Icon = ICONS[row.action] ?? Pencil
  const actorName =
    row.actor?.name ??
    row.actor?.email?.split('@')[0] ??
    'System'
  const sentence = describeAction(row, {
    statusNameById,
    categoryNameById,
    labelNameById,
    memberNameById,
  })

  return (
    <li className="flex items-start gap-2">
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-3" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-xs">
          <span className="font-medium text-foreground">{actorName}</span>{' '}
          <span className="text-muted-foreground">{sentence}</span>
        </p>
        <p className="text-[10px] text-muted-foreground/70">
          {formatDistanceToNow(row.createdAt, { addSuffix: true })}
        </p>
      </div>
    </li>
  )
}

interface Resolvers {
  statusNameById: Map<string, string>
  categoryNameById: Map<string, string>
  labelNameById: Map<string, string>
  memberNameById: Map<string, string>
}

function describeAction(row: TaskActivityRow, r: Resolvers): string {
  const from = row.fromValue as Record<string, unknown> | string | null
  const to = row.toValue as Record<string, unknown> | string | null

  switch (row.action) {
    case 'created':
      return 'created this task'
    case 'status_changed': {
      const fromName = typeof from === 'string' ? r.statusNameById.get(from) : null
      const toName = typeof to === 'string' ? r.statusNameById.get(to) : null
      if (fromName && toName) return `moved status from ${fromName} to ${toName}`
      if (toName) return `set status to ${toName}`
      return 'changed status'
    }
    case 'priority_changed': {
      const label = typeof to === 'string'
        ? TASK_PRIORITY_LABELS[to as keyof typeof TASK_PRIORITY_LABELS]
        : null
      return label ? `set priority to ${label}` : 'changed priority'
    }
    case 'category_changed': {
      if (to === null) return 'cleared the category'
      const name = typeof to === 'string' ? r.categoryNameById.get(to) : null
      return name ? `set category to ${name}` : 'changed category'
    }
    case 'due_date_changed':
      if (to === null) return 'cleared the due date'
      if (typeof to === 'string') {
        // toValue is a Date serialized to ISO; take first 10 chars.
        return `set due date to ${to.slice(0, 10)}`
      }
      return 'changed the due date'
    case 'assigned': {
      const [added, removed] = diffIdArrays(from, to)
      return summarizePeopleDiff(added, removed, r.memberNameById, 'assigned')
    }
    case 'unassigned': {
      const id = extractSingleUserId(from)
      const name = id ? r.memberNameById.get(id) : null
      return name ? `unassigned ${name}` : 'unassigned someone'
    }
    case 'watcher_added': {
      // Batch form (from setWatchers) and single form (from watch())
      // share this verb. Diff the arrays if we have both sides.
      if (Array.isArray(from) && Array.isArray(to)) {
        const [added, removed] = diffIdArrays(from, to)
        return summarizePeopleDiff(added, removed, r.memberNameById, 'watching')
      }
      const id = extractSingleUserId(to)
      const name = id ? r.memberNameById.get(id) : null
      return name ? `added ${name} as a watcher` : 'added a watcher'
    }
    case 'watcher_removed': {
      const id = extractSingleUserId(from)
      const name = id ? r.memberNameById.get(id) : null
      return name ? `removed ${name} as a watcher` : 'removed a watcher'
    }
    case 'labels_changed': {
      const [added, removed] = diffIdArrays(from, to)
      const addedNames = added
        .map((id) => r.labelNameById.get(id))
        .filter((n): n is string => !!n)
      const removedNames = removed
        .map((id) => r.labelNameById.get(id))
        .filter((n): n is string => !!n)
      const parts: string[] = []
      if (addedNames.length) parts.push(`added ${addedNames.join(', ')}`)
      if (removedNames.length) parts.push(`removed ${removedNames.join(', ')}`)
      return parts.length > 0
        ? `${parts.join(' and ')} label${addedNames.length + removedNames.length > 1 ? 's' : ''}`
        : 'changed labels'
    }
    case 'archived':
      return 'archived this task'
    case 'restored':
      return 'restored this task'
    case 'deleted':
      return 'deleted this task'
    case 'comment_added':
      return 'added a comment'
    case 'comment_edited':
      return 'edited a comment'
    case 'comment_deleted':
      return 'deleted a comment'
    case 'checklist_added':
      return `added a checklist${nameFromObject(to, 'title')}`
    case 'checklist_deleted':
      return `deleted a checklist${nameFromObject(from, 'title')}`
    case 'checklist_item_added':
      return `added a checklist item${nameFromObject(to, 'text')}`
    case 'checklist_item_toggled':
      return isDone(to) ? 'checked off an item' : 'unchecked an item'
    case 'checklist_item_deleted':
      return `deleted a checklist item${nameFromObject(from, 'text')}`
    case 'attachment_added':
      return 'attached a file'
    case 'attachment_removed':
      return 'removed an attachment'
    case 'updated':
      return 'updated the task'
    default:
      return `${(row.action as string).replaceAll('_', ' ')}`
  }
}

// =========================================================
// Helpers
// =========================================================

function diffIdArrays(from: unknown, to: unknown): [string[], string[]] {
  const a = new Set(Array.isArray(from) ? (from as string[]) : [])
  const b = new Set(Array.isArray(to) ? (to as string[]) : [])
  const added = [...b].filter((id) => !a.has(id))
  const removed = [...a].filter((id) => !b.has(id))
  return [added, removed]
}

function summarizePeopleDiff(
  added: string[],
  removed: string[],
  names: Map<string, string>,
  verb: 'assigned' | 'watching',
): string {
  const nameList = (ids: string[]) =>
    ids
      .map((id) => names.get(id))
      .filter((n): n is string => !!n)
      .join(', ')
  const addNames = nameList(added)
  const removeNames = nameList(removed)
  if (addNames && removeNames) {
    return verb === 'assigned'
      ? `assigned ${addNames}, unassigned ${removeNames}`
      : `added ${addNames}, removed ${removeNames} from watchers`
  }
  if (addNames) {
    return verb === 'assigned'
      ? `assigned ${addNames}`
      : `added ${addNames} as watcher${added.length > 1 ? 's' : ''}`
  }
  if (removeNames) {
    return verb === 'assigned'
      ? `unassigned ${removeNames}`
      : `removed ${removeNames} from watchers`
  }
  return verb === 'assigned' ? 'changed assignees' : 'changed watchers'
}

function extractSingleUserId(v: unknown): string | null {
  if (!v || typeof v !== 'object') return null
  const rec = v as Record<string, unknown>
  return typeof rec.userId === 'string' ? rec.userId : null
}

function nameFromObject(v: unknown, key: string): string {
  if (!v || typeof v !== 'object') return ''
  const rec = v as Record<string, unknown>
  const val = rec[key]
  return typeof val === 'string' && val.length > 0 ? `: "${val}"` : ''
}

function isDone(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false
  const rec = v as Record<string, unknown>
  return rec.isDone === true
}
