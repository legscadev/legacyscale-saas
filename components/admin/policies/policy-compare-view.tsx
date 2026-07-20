'use client'

// Side-by-side compare of two policy snapshots. No text-diff yet —
// this is visual "read them side by side" since Tiptap HTML doesn't
// diff cleanly without a semantic layer.  Good enough for admins
// deciding whether to revert; a real HTML diff can land later.
//
// Picker UX: two dropdowns (left + right) each pick any frozen
// revision OR the current draft. Defaults: left = previous revision,
// right = current. Swaps via router.push (no local mutation) so
// the view is a stable, shareable URL.
//
// The `sentinel` value 'current' is a magic string in the URL — a
// UUID revisionId parses cleanly and 'current' is a reserved word
// that maps to the live Policy row.

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useTransition } from 'react'
import { ArrowLeft, ArrowLeftRight, Check, Undo2 } from 'lucide-react'
import { toast } from 'sonner'

import { revertPolicyAction } from '@/app/(admin)/admin/policies/actions'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { fmtCalendarDate, relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  PolicyDetail,
  PolicyRevisionRow,
} from '@/lib/services/policy-service'

import { PolicyBodyHtml } from './policy-body-html'
import { RevisionBadge } from './policy-pills'

const CURRENT_SENTINEL = 'current'

interface SnapshotSlot {
  /** Human label for the picker + column header. */
  label: string
  /** Rev N label (or 'Draft' / 'Current') for the badge. */
  revision: number
  title: string
  body: string | null
  publishedAt: Date | null
  publishedByName: string | null
  /** Set for frozen-revision slots so we can offer Revert. */
  revisionId: string | null
}

interface PolicyCompareViewProps {
  policy: PolicyDetail
  revisions: PolicyRevisionRow[]
  /** Server-resolved snapshots — page.tsx does the fetching so this
   *  component is a pure renderer. */
  leftSnapshot: SnapshotSlot
  rightSnapshot: SnapshotSlot
}

export function PolicyCompareView({
  policy,
  revisions,
  leftSnapshot,
  rightSnapshot,
}: PolicyCompareViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isReverting, startRevert] = useTransition()

  const paramsCopy = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  )

  function pushSide(side: 'from' | 'to', value: string) {
    const next = new URLSearchParams(paramsCopy)
    next.set(side, value)
    router.push(`/admin/policies/${policy.id}/compare?${next.toString()}`)
  }

  function swap() {
    const from = searchParams.get('from') ?? previousRevisionId()
    const to = searchParams.get('to') ?? CURRENT_SENTINEL
    const next = new URLSearchParams(paramsCopy)
    next.set('from', to)
    next.set('to', from)
    router.push(`/admin/policies/${policy.id}/compare?${next.toString()}`)
  }

  function previousRevisionId(): string {
    const prior = revisions.find((r) => r.revision < policy.revision)
    return prior?.id ?? CURRENT_SENTINEL
  }

  function handleRevert(revisionId: string) {
    startRevert(async () => {
      const res = await revertPolicyAction({
        policyId: policy.id,
        revisionId,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not revert')
        return
      }
      toast.success(`Reverted — Rev ${res.data.revision} cut`)
      router.push(`/admin/policies/${policy.id}`)
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Policies', href: '/admin/policies' },
          { label: policy.title, href: `/admin/policies/${policy.id}` },
          { label: 'Compare' },
        ]}
        title="Compare revisions"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={swap}
              aria-label="Swap sides"
            >
              <ArrowLeftRight className="size-4" />
              Swap
            </Button>
            <Button
              variant="ghost"
              size="sm"
              render={
                <Link href={`/admin/policies/${policy.id}`}>
                  <ArrowLeft className="size-4" />
                  Back to policy
                </Link>
              }
            />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CompareColumn
          side="from"
          heading="Older"
          snapshot={leftSnapshot}
          activeValue={
            leftSnapshot.revisionId ?? CURRENT_SENTINEL
          }
          policy={policy}
          revisions={revisions}
          onPick={(value) => pushSide('from', value)}
          onRevert={leftSnapshot.revisionId ? handleRevert : undefined}
          reverting={isReverting}
        />
        <CompareColumn
          side="to"
          heading="Newer"
          snapshot={rightSnapshot}
          activeValue={
            rightSnapshot.revisionId ?? CURRENT_SENTINEL
          }
          policy={policy}
          revisions={revisions}
          onPick={(value) => pushSide('to', value)}
          onRevert={rightSnapshot.revisionId ? handleRevert : undefined}
          reverting={isReverting}
        />
      </div>
    </div>
  )
}

interface CompareColumnProps {
  side: 'from' | 'to'
  heading: string
  snapshot: SnapshotSlot
  activeValue: string
  policy: PolicyDetail
  revisions: PolicyRevisionRow[]
  onPick: (value: string) => void
  onRevert?: (revisionId: string) => void
  reverting: boolean
}

function CompareColumn({
  side,
  heading,
  snapshot,
  activeValue,
  policy,
  revisions,
  onPick,
  onRevert,
  reverting,
}: CompareColumnProps) {
  const revisionId =
    activeValue === CURRENT_SENTINEL ? null : activeValue

  return (
    <section className="flex min-w-0 flex-col rounded-lg border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {heading}
          </span>
          <RevisionBadge revision={snapshot.revision} />
        </div>
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    'inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-xs shadow-xs',
                    'transition-colors hover:bg-accent hover:text-accent-foreground',
                  )}
                />
              }
            >
              {snapshot.label}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => onPick(CURRENT_SENTINEL)}>
                <span className="flex-1">
                  Current ({policy.revision === 0
                    ? 'Draft'
                    : `Rev ${policy.revision}`})
                </span>
                {activeValue === CURRENT_SENTINEL ? (
                  <Check className="size-3.5" aria-hidden />
                ) : null}
              </DropdownMenuItem>
              {revisions.map((rev) => (
                <DropdownMenuItem
                  key={rev.id}
                  onClick={() => onPick(rev.id)}
                >
                  <span className="flex-1">Rev {rev.revision}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {fmtCalendarDate(rev.publishedAt)}
                  </span>
                  {activeValue === rev.id ? (
                    <Check className="ml-2 size-3.5" aria-hidden />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {revisionId && onRevert ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRevert(revisionId)}
              disabled={reverting}
              className="h-7 gap-1"
            >
              <Undo2 className="size-3" />
              Revert
            </Button>
          ) : null}
        </div>
      </header>

      <div className="p-3">
        <p className="line-clamp-1 text-base font-semibold text-foreground">
          {snapshot.title}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {snapshot.publishedAt
            ? `${fmtCalendarDate(snapshot.publishedAt)} · ${relativeTime(snapshot.publishedAt)}`
            : 'Working draft — not yet published'}
          {snapshot.publishedByName
            ? ` · ${snapshot.publishedByName}`
            : ''}
        </p>
      </div>

      <div className="max-h-[70vh] overflow-y-auto border-t p-4">
        <PolicyBodyHtml html={snapshot.body} />
      </div>
    </section>
  )
}

// Exported so page.tsx can build server-side snapshots without a
// second copy of the mapping logic.
export function buildSnapshot({
  policy,
  revision,
}: {
  policy: PolicyDetail
  revision: PolicyRevisionRow & { body: string | null } | null
}): SnapshotSlot {
  if (revision === null) {
    return {
      label:
        policy.revision === 0 ? 'Current draft' : `Current (Rev ${policy.revision})`,
      revision: policy.revision,
      title: policy.title,
      body: policy.body,
      publishedAt: policy.publishedAt,
      publishedByName:
        policy.updatedByUser?.name ??
        policy.updatedByUser?.email.split('@')[0] ??
        null,
      revisionId: null,
    }
  }
  return {
    label: `Rev ${revision.revision}`,
    revision: revision.revision,
    title: revision.title,
    body: revision.body,
    publishedAt: revision.publishedAt,
    publishedByName:
      revision.publishedBy?.name ??
      revision.publishedBy?.email.split('@')[0] ??
      null,
    revisionId: revision.id,
  }
}

export { CURRENT_SENTINEL }
