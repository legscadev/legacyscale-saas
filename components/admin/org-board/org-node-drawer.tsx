'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import type {
  OrgNodeRow,
  PositionAssignmentRow,
} from '@/lib/services/org-board-service'

import {
  listPositionAssignmentsAction,
} from '@/app/(admin)/admin/org-board/actions'
import { HolderText } from './holder-text'
import { OrgNodeEditDialog } from './org-node-dialogs'

interface OrgNodeDrawerProps {
  node: OrgNodeRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Compact side-sheet with all the info the drill-down page shows,
 * without a page navigation. Opens when a chart node is clicked.
 */
export function OrgNodeDrawer({ node, open, onOpenChange }: OrgNodeDrawerProps) {
  const [assignments, setAssignments] = useState<PositionAssignmentRow[] | null>(
    null,
  )
  const [loading, setLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    if (!open || !node) return
    let cancelled = false
    setLoading(true)
    listPositionAssignmentsAction(node.id, { includeEnded: false })
      .then((rows) => {
        if (cancelled) return
        setAssignments(rows)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        toast.error('Failed to load assignments')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, node])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        {node ? (
          <div className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle className="text-lg">{node.label}</SheetTitle>
              {node.positionTitle ? (
                <SheetDescription>{node.positionTitle}</SheetDescription>
              ) : null}
            </SheetHeader>

            <div className="mt-4 flex-1 space-y-5 overflow-y-auto pr-1">
              {/* Primary holder */}
              <section className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Primary holder
                </p>
                <p className="text-sm font-medium">
                  <HolderText
                    holder={node.holder}
                    unassignedClassName="italic text-muted-foreground"
                  />
                </p>
              </section>

              {/* Active assignments */}
              <section className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Active assignments
                </p>
                {loading ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    Loading…
                  </p>
                ) : assignments && assignments.length > 0 ? (
                  <ul className="divide-y rounded-md border">
                    {assignments.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-2 px-3 py-2 text-sm"
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                          {(a.employee.name ?? '?').slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {a.employee.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {a.employmentType?.replace('_', ' ').toLowerCase() ??
                              a.employee.roleTitle}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No active assignments.
                  </p>
                )}
              </section>

              {node.functionText ? (
                <section className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Function
                  </p>
                  <p className="whitespace-pre-line text-sm">
                    {node.functionText}
                  </p>
                </section>
              ) : null}

              {node.responsibilities.length > 0 ? (
                <section className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Responsibilities
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-sm">
                    {node.responsibilities.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {node.notes ? (
                <section className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Notes
                  </p>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">
                    {node.notes}
                  </p>
                </section>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
              <Link
                href={`/admin/org-board/nodes/${node.id}`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Full page
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>

            <OrgNodeEditDialog
              open={editOpen}
              onOpenChange={setEditOpen}
              node={node}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
