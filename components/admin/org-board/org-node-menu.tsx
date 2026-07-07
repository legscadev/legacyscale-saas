'use client'

import { useState, useTransition } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { OrgNodeRow } from '@/lib/services/org-board-service'
import type {
  OrgNodeKindValue,
} from '@/lib/validations/org-board'

import {
  deleteOrgNodeAction,
  getOrgNodeDeleteImpactAction,
  moveOrgNodeAction,
} from '@/app/(admin)/admin/org-board/actions'
import { OrgNodeEditDialog } from './org-node-dialogs'
import { OrgNodeAddDialog } from './org-node-dialogs'

/**
 * Node context menu — the small triangle-ish caret you saw on the
 * Makh cards. Menu items change with node kind: e.g. Divisions
 * expose "Add Department"; Departments expose "Add Section". All
 * mutations call the corresponding server action then refresh the
 * router (parent is expected to be a client component wrapping the
 * whole card).
 */

interface OrgNodeMenuProps {
  node: OrgNodeRow
  /** Layout hint — some cards render as columns (siblings across),
   *  others as stacked rows (siblings top-to-bottom). We use this
   *  to pick the right move arrow labels. */
  layout: 'row' | 'column'
  /** Trigger class overrides so the caret can match its card. */
  triggerClassName?: string
}

export function OrgNodeMenu({ node, layout, triggerClassName }: OrgNodeMenuProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [addKind, setAddKind] = useState<OrgNodeKindValue | null>(null)
  const [deleteState, setDeleteState] = useState<null | {
    descendantCount: number
    positionsWithEmployeeCount: number
  }>(null)
  const [pending, startTransition] = useTransition()

  function move(direction: 'up' | 'down' | 'left' | 'right') {
    startTransition(async () => {
      try {
        await moveOrgNodeAction(node.id, { direction })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to move')
      }
    })
  }

  async function askDelete() {
    try {
      const impact = await getOrgNodeDeleteImpactAction(node.id)
      setDeleteState(impact)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load impact')
    }
  }

  function confirmDelete() {
    startTransition(async () => {
      try {
        await deleteOrgNodeAction(node.id)
        toast.success(`Removed "${node.label}"`)
        setDeleteState(null)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to remove')
      }
    })
  }

  // Which items to show per kind — matches the Makh menu screenshots.
  const items = menuItemsForKind(node.kind)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Node actions"
          disabled={pending}
          render={
            <button
              type="button"
              className={cn(
                'inline-flex size-5 items-center justify-center rounded transition-colors',
                'hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40',
                triggerClassName,
              )}
            />
          }
        >
          <ChevronDown className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[10rem]">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" /> Edit
          </DropdownMenuItem>

          {items.canBumpUp ? (
            <DropdownMenuItem onClick={() => move(layout === 'column' ? 'left' : 'up')}>
              {layout === 'column' ? (
                <ArrowLeft className="size-3.5" />
              ) : (
                <ArrowUp className="size-3.5" />
              )}
              {layout === 'column' ? 'Move Left' : 'Bump Up'}
            </DropdownMenuItem>
          ) : null}
          {items.canBumpDown ? (
            <DropdownMenuItem onClick={() => move(layout === 'column' ? 'right' : 'down')}>
              {layout === 'column' ? (
                <ArrowRight className="size-3.5" />
              ) : (
                <ArrowDown className="size-3.5" />
              )}
              {layout === 'column' ? 'Move Right' : 'Bump Down'}
            </DropdownMenuItem>
          ) : null}

          {items.addKinds.length > 0 ? <DropdownMenuSeparator /> : null}
          {items.addKinds.map((k) => (
            <DropdownMenuItem key={k.kind} onClick={() => setAddKind(k.kind)}>
              <Plus className="size-3.5" />
              {k.label}
            </DropdownMenuItem>
          ))}

          {items.canRemove ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={askDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Remove
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <OrgNodeEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        node={node}
      />

      <OrgNodeAddDialog
        open={addKind !== null}
        onOpenChange={(v) => !v && setAddKind(null)}
        parent={node}
        childKind={addKind}
      />

      <AlertDialog
        open={deleteState !== null}
        onOpenChange={(v) => !v && setDeleteState(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove &ldquo;{node.label}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteState?.descendantCount === 0
                ? 'Nothing sits underneath — safe to remove.'
                : `This will also remove ${deleteState?.descendantCount} descendant node${
                    deleteState?.descendantCount === 1 ? '' : 's'
                  }${
                    deleteState && deleteState.positionsWithEmployeeCount > 0
                      ? ` and unlink ${deleteState.positionsWithEmployeeCount} employee assignment${
                          deleteState.positionsWithEmployeeCount === 1 ? '' : 's'
                        }`
                      : ''
                  }. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Removing…
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

interface KindItems {
  canBumpUp: boolean
  canBumpDown: boolean
  canRemove: boolean
  addKinds: Array<{ kind: OrgNodeKindValue; label: string }>
}

function menuItemsForKind(kind: OrgNodeRow['kind']): KindItems {
  switch (kind) {
    case 'CROWN':
      return {
        canBumpUp: true,
        canBumpDown: true,
        canRemove: true,
        addKinds: [
          { kind: 'POSITION', label: 'Add Position' },
          { kind: 'DIVISION', label: 'Add Division' },
        ],
      }
    case 'DIVISION':
      return {
        canBumpUp: true,
        canBumpDown: true,
        canRemove: true,
        addKinds: [
          { kind: 'DEPARTMENT', label: 'Add Department' },
          { kind: 'POSITION', label: 'Add Deputy' },
        ],
      }
    case 'DEPARTMENT':
      return {
        canBumpUp: true,
        canBumpDown: true,
        canRemove: true,
        addKinds: [
          { kind: 'SECTION', label: 'Add Section' },
          { kind: 'POSITION', label: 'Add Position' },
        ],
      }
    case 'SECTION':
    case 'UNIT':
      return {
        canBumpUp: true,
        canBumpDown: true,
        canRemove: true,
        addKinds: [
          { kind: 'UNIT', label: 'Add Unit' },
          { kind: 'POSITION', label: 'Add Position' },
        ],
      }
    case 'POSITION':
      return {
        canBumpUp: true,
        canBumpDown: true,
        canRemove: true,
        addKinds: [],
      }
  }
}
