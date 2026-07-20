'use client'

// Row-action dropdown for the policies table. Ghost 3-dot in the
// trailing edge of each row; stops propagation so the parent row's
// "open detail" navigation doesn't fire on menu clicks.
//
// Edit is a link (deep-linkable + right-clickable); mutations run
// through server actions. Delete is soft — the row appears as
// deleted+restorable in the archived filter view.

import Link from 'next/link'
import { useTransition } from 'react'
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  archivePolicyAction,
  deletePolicyAction,
  publishPolicyAction,
  restorePolicyAction,
} from '@/app/(admin)/admin/policies/actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { PolicyListItem } from '@/lib/services/policy-service'

interface PolicyRowActionsProps {
  policy: PolicyListItem
  onChanged: () => void | Promise<void>
}

export function PolicyRowActions({
  policy,
  onChanged,
}: PolicyRowActionsProps) {
  const [isPending, startTransition] = useTransition()
  const isArchived = policy.archivedAt !== null

  function run(
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ) {
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        toast.error(res.error ?? `Could not ${label.toLowerCase()}`)
        return
      }
      toast.success(`${label}d`)
      await onChanged()
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        render={
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Actions for ${policy.title}`}
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          render={
            <Link href={`/admin/policies/${policy.id}/edit`}>
              <Pencil className="size-4" />
              Edit
            </Link>
          }
        />

        {policy.status !== 'ARCHIVED' ? (
          <DropdownMenuItem
            onClick={() =>
              run(
                policy.revision === 0 ? 'Publish' : 'Republish',
                () => publishPolicyAction(policy.id),
              )
            }
          >
            <Send className="size-4" />
            {policy.revision === 0 ? 'Publish' : 'Republish'}
          </DropdownMenuItem>
        ) : null}

        {isArchived ? (
          <DropdownMenuItem
            onClick={() =>
              run('Restore', () => restorePolicyAction(policy.id))
            }
          >
            <ArchiveRestore className="size-4" />
            Restore
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() =>
              run('Archive', () => archivePolicyAction(policy.id))
            }
          >
            <Archive className="size-4" />
            Archive
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => run('Delete', () => deletePolicyAction(policy.id))}
        >
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
