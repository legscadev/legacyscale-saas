'use client'

// Task notifications bell for the admin top-bar. Fetches on mount
// (once) + on open + after every mark-read so the badge always
// reflects the current unread count. Uses a Popover-style
// dropdown built on the existing DropdownMenu primitive to match
// the announcement bell's affordance.

import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { Bell, CheckCheck, Inbox } from 'lucide-react'
import { toast } from 'sonner'

import {
  fetchTaskNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationsReadAction,
  type NotificationBellPayload,
} from '@/app/(admin)/admin/tasks/notification-actions'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { TaskNotificationRow } from '@/lib/services/task-notification-service'

const KIND_LABEL: Record<string, string> = {
  assigned: 'assigned you a task',
  unassigned: 'unassigned you from a task',
  comment_added: 'commented on a task',
  status_changed: 'changed a task status',
  watcher_added: 'added you as a watcher',
}

export function TaskNotificationsBell() {
  const router = useRouter()
  const [payload, setPayload] = useState<NotificationBellPayload>({
    unread: 0,
    items: [],
  })
  const [open, setOpen] = useState(false)
  const [isBusy, startBusy] = useTransition()

  const refetch = useCallback(async () => {
    const res = await fetchTaskNotificationsAction()
    if (res.ok) setPayload(res.data)
  }, [])

  // Initial fetch + refetch when the popover opens (light polling
  // is fine here since the surface is admin-only + low-traffic).
  useEffect(() => {
    refetch()
  }, [refetch])
  useEffect(() => {
    if (open) refetch()
  }, [open, refetch])

  function goToTask(row: TaskNotificationRow) {
    // Mark this row read, then navigate. Fire-and-forget on the
    // mark so navigation isn't delayed by the round trip; the
    // next open of the bell will reconcile.
    if (!row.readAt) {
      startBusy(async () => {
        await markNotificationsReadAction([row.id])
        await refetch()
      })
    }
    setOpen(false)
    router.push(`/admin/tasks?task=${row.taskId}`)
  }

  function markAll() {
    startBusy(async () => {
      const res = await markAllNotificationsReadAction()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      await refetch()
    })
  }

  const { unread, items } = payload

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={
                    unread > 0
                      ? `Task notifications (${unread} unread)`
                      : 'Task notifications'
                  }
                  className="relative"
                />
              }
            >
              <Inbox />
              {unread > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground tabular-nums ring-2 ring-background"
                >
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </DropdownMenuTrigger>
          }
        />
        <TooltipContent side="bottom">
          {unread > 0 ? `Tasks · ${unread} unread` : 'Task notifications'}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Task notifications</p>
          {unread > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAll}
              disabled={isBusy}
              className="h-6 gap-1 text-[11px]"
            >
              <CheckCheck className="size-3" />
              Mark all read
            </Button>
          ) : null}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-xs text-muted-foreground">
              <Bell className="size-6 opacity-40" aria-hidden />
              No notifications yet.
            </div>
          ) : (
            <ul>
              {items.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => goToTask(row)}
                    className={cn(
                      'flex w-full items-start gap-2 border-b px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-muted/60',
                      !row.readAt && 'bg-primary/5',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-1.5 size-2 shrink-0 rounded-full',
                        row.readAt ? 'bg-transparent' : 'bg-primary',
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-xs text-foreground">
                        <span className="font-medium">
                          {row.actor?.name ??
                            row.actor?.email?.split('@')[0] ??
                            'System'}
                        </span>{' '}
                        <span className="text-muted-foreground">
                          {KIND_LABEL[row.kind] ?? row.kind.replaceAll('_', ' ')}
                        </span>{' '}
                        <span className="font-medium">{row.taskTitle}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground/70">
                        {formatDistanceToNow(row.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
