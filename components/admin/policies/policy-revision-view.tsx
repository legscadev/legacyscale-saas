'use client'

// Read-only view of a frozen PolicyRevision. Same reading layout
// as the detail view but locked to the historical snapshot's
// title + body + publish metadata. "Revert to this revision"
// re-cuts the current row from this snapshot (server-side).

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { ArrowLeft, BookText, History, Undo2 } from 'lucide-react'
import { toast } from 'sonner'

import { revertPolicyAction } from '@/app/(admin)/admin/policies/actions'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { fmtCalendarDate, relativeTime } from '@/lib/format'
import type {
  PolicyDetail,
  PolicyRevisionDetail,
} from '@/lib/services/policy-service'

import { PolicyBodyHtml } from './policy-body-html'
import { RevisionBadge } from './policy-pills'

interface PolicyRevisionViewProps {
  policy: PolicyDetail
  revision: PolicyRevisionDetail
}

export function PolicyRevisionView({
  policy,
  revision,
}: PolicyRevisionViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const isCurrent = revision.revision === policy.revision
  const isSuperseded = revision.revision < policy.revision

  function handleRevert() {
    startTransition(async () => {
      const res = await revertPolicyAction({
        policyId: policy.id,
        revisionId: revision.id,
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
        title={revision.title}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              render={
                <Link href={`/admin/policies/${policy.id}`}>
                  <ArrowLeft className="size-4" />
                  Back to policy
                </Link>
              }
            />
            {isSuperseded ? (
              <Button onClick={handleRevert} disabled={isPending}>
                <Undo2 className="size-4" />
                {isPending
                  ? 'Reverting…'
                  : `Revert to Rev ${revision.revision}`}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5">
          <History className="size-3" aria-hidden />
          Historical snapshot
        </span>
        <RevisionBadge revision={revision.revision} />
        <span>Published {fmtCalendarDate(revision.publishedAt)}</span>
        {revision.publishedBy ? (
          <span>
            by{' '}
            {revision.publishedBy.name ??
              revision.publishedBy.email.split('@')[0]}
          </span>
        ) : null}
        <span>· {relativeTime(revision.publishedAt)}</span>
      </div>

      {isCurrent ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <p className="font-medium">This is the current published revision.</p>
          <p className="mt-0.5 text-emerald-700 dark:text-emerald-400">
            Edits on the main page continue from here.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <div className="flex items-start gap-2">
            <BookText className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-medium">
                This is an older revision (Rev {revision.revision} of{' '}
                {policy.revision}).
              </p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                Reverting cuts a new Rev {policy.revision + 1} from this
                snapshot; the intervening revisions stay in the timeline.
              </p>
            </div>
          </div>
        </div>
      )}

      <article className="rounded-lg border bg-card p-6 shadow-xs">
        <PolicyBodyHtml html={revision.body} />
      </article>
    </div>
  )
}
