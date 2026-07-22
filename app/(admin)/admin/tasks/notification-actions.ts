'use server'

// Notification-only actions kept in a separate file from
// tasks/actions.ts so the top-bar bell dropdown doesn't drag the
// full workspace surface into every admin page's bundle.
//
// Gated on the same "tasks" module grant as the workspace itself
// so TEAM users with tasks access also get their notifications
// (assigned, unassigned, comments, status changes, watcher adds).

import { revalidatePath } from 'next/cache'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import {
  taskNotificationService,
  type TaskNotificationRow,
} from '@/lib/services/task-notification-service'

export interface NotificationBellPayload {
  unread: number
  items: TaskNotificationRow[]
}

/**
 * Bundled bell fetch — unread count + latest 15 rows in one round
 * trip. The dropdown re-fetches on open + after every mark-read
 * action so counts don't drift.
 */
export async function fetchTaskNotificationsAction(): Promise<
  | { ok: true; data: NotificationBellPayload }
  | { ok: false; error: string }
> {
  const user = await requireTeamModuleAccess('tasks')
  try {
    const [unread, items] = await Promise.all([
      taskNotificationService.countUnread(user.id),
      taskNotificationService.listForRecipient(user.id, { limit: 15 }),
    ])
    return { ok: true, data: { unread, items } }
  } catch (err) {
    console.error('[tasks/notifications]', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not load notifications',
    }
  }
}

export async function markNotificationsReadAction(
  ids: string[],
): Promise<{ ok: true; data: { count: number } } | { ok: false; error: string }> {
  const user = await requireTeamModuleAccess('tasks')
  try {
    const count = await taskNotificationService.markRead(user.id, ids)
    revalidatePath('/admin', 'layout')
    return { ok: true, data: { count } }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not mark as read',
    }
  }
}

export async function markAllNotificationsReadAction(): Promise<
  { ok: true; data: { count: number } } | { ok: false; error: string }
> {
  const user = await requireTeamModuleAccess('tasks')
  try {
    const count = await taskNotificationService.markAllRead(user.id)
    revalidatePath('/admin', 'layout')
    return { ok: true, data: { count } }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not mark all as read',
    }
  }
}
