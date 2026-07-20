'use client'

// Detail read view for /admin/policies/[id]. Renders the current
// title/body/metadata + a sidebar with attachments, revisions, and
// recent activity. All mutations are deferred to the /edit page
// or the header row actions — this view is read-only.

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import {
  Archive,
  ArchiveRestore,
  ExternalLink,
  Paperclip,
  Pencil,
  Printer,
  Send,
  Trash2,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  archivePolicyAction,
  deletePolicyAction,
  publishPolicyAction,
  restorePolicyAction,
  revertPolicyAction,
  signPolicyAttachmentUrlAction,
  type PolicyDetailPayload,
} from '@/app/(admin)/admin/policies/actions'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { fmtCalendarDate, relativeTime } from '@/lib/format'

import {
  CategoryChip,
  PolicyStatusPill,
  RevisionBadge,
} from './policy-pills'
import { PolicyBodyHtml } from './policy-body-html'

interface PolicyDetailViewProps {
  data: PolicyDetailPayload
}

export function PolicyDetailView({ data }: PolicyDetailViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { policy, revisions, attachments, activity } = data
  const isArchived = policy.archivedAt !== null

  function refresh() {
    startTransition(() => {
      router.refresh()
    })
  }

  function run(
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    afterOk?: () => void,
  ) {
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        toast.error(res.error ?? `Could not ${label.toLowerCase()}`)
        return
      }
      toast.success(`${label}d`)
      if (afterOk) afterOk()
      else router.refresh()
    })
  }

  async function handleDownload(attachmentId: string) {
    const res = await signPolicyAttachmentUrlAction(attachmentId)
    if (!res.ok) {
      toast.error(res.error ?? 'Could not open attachment')
      return
    }
    window.open(res.data.url, '_blank', 'noopener,noreferrer')
  }

  function handleDelete() {
    run(
      'Delete',
      () => deletePolicyAction(policy.id),
      () => router.push('/admin/policies'),
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={policy.title}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {policy.status !== 'ARCHIVED' ? (
              <Button
                variant="outline"
                onClick={() =>
                  run(
                    policy.revision === 0 ? 'Publish' : 'Republish',
                    () => publishPolicyAction(policy.id),
                  )
                }
                disabled={isPending}
              >
                <Send className="size-4" />
                {policy.revision === 0 ? 'Publish' : 'Republish'}
              </Button>
            ) : null}
            <Button
              variant="outline"
              render={
                <Link href={`/admin/policies/${policy.id}/print`}>
                  <Printer className="size-4" />
                  Print
                </Link>
              }
            />
            <Button
              render={
                <Link href={`/admin/policies/${policy.id}/edit`}>
                  <Pencil className="size-4" />
                  Edit
                </Link>
              }
            />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <PolicyStatusPill status={policy.status} />
        <RevisionBadge revision={policy.revision} />
        {policy.category ? (
          <CategoryChip
            name={policy.category.name}
            color={policy.category.color}
          />
        ) : null}
        <span className="text-xs text-muted-foreground">
          Updated {relativeTime(policy.updatedAt)}
          {policy.updatedByUser
            ? ` by ${policy.updatedByUser.name ?? policy.updatedByUser.email.split('@')[0]}`
            : ''}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-lg border bg-card p-6 shadow-xs">
          <PolicyBodyHtml html={policy.body} />
          {policy.revision > 0 ? (
            <div className="mt-8 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                <strong className="font-medium text-foreground">
                  Revision:
                </strong>{' '}
                {policy.revision} · Published{' '}
                {policy.publishedAt
                  ? fmtCalendarDate(policy.publishedAt)
                  : '—'}
              </p>
            </div>
          ) : null}
        </article>

        <aside className="space-y-4">
          <SidebarSection
            title="Attachments"
            count={attachments.length}
            empty="No attachments"
          >
            <ul className="space-y-1.5">
              {attachments.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => handleDownload(a.id)}
                    className="flex w-full items-start gap-2 rounded-md border bg-background px-2.5 py-2 text-left text-xs transition-colors hover:bg-accent"
                  >
                    {a.sourceUrl ? (
                      <ExternalLink
                        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    ) : (
                      <Paperclip
                        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 font-medium text-foreground">
                        {a.name}
                      </span>
                      {a.uploadedBy ? (
                        <span className="block text-[10px] text-muted-foreground">
                          {a.uploadedBy.name ?? 'Someone'}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </SidebarSection>

          <SidebarSection
            title="Revisions"
            count={revisions.length}
            empty="No revisions yet — publish to cut Rev I"
          >
            <ul className="space-y-1.5">
              {revisions.map((rev) => (
                <li
                  key={rev.id}
                  className="flex items-start gap-2 rounded-md border bg-background px-2.5 py-2 text-xs"
                >
                  <RevisionBadge revision={rev.revision} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 font-medium text-foreground">
                      {rev.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {fmtCalendarDate(rev.publishedAt)}
                      {rev.publishedBy
                        ? ` · ${rev.publishedBy.name ?? rev.publishedBy.email.split('@')[0]}`
                        : ''}
                    </p>
                  </div>
                  {rev.revision < policy.revision ? (
                    <button
                      type="button"
                      title={`Revert to Rev ${rev.revision}`}
                      onClick={() =>
                        run('Revert', () =>
                          revertPolicyAction({
                            policyId: policy.id,
                            revisionId: rev.id,
                          }),
                        )
                      }
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Undo2 className="size-3.5" aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </SidebarSection>

          <SidebarSection
            title="Activity"
            count={activity.length}
            empty="No activity yet"
          >
            <ul className="space-y-1.5 text-xs">
              {activity.slice(0, 12).map((a) => (
                <li key={a.id} className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {a.actor?.name ?? 'Someone'}
                  </span>{' '}
                  {a.action.replace(/_/g, ' ')} ·{' '}
                  <span className="tabular-nums">
                    {relativeTime(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </SidebarSection>

          <SidebarSection title="Danger zone">
            <div className="flex flex-col gap-2">
              {isArchived ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    run('Restore', () => restorePolicyAction(policy.id))
                  }
                  disabled={isPending}
                >
                  <ArchiveRestore className="size-3.5" />
                  Restore
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    run('Archive', () => archivePolicyAction(policy.id))
                  }
                  disabled={isPending}
                >
                  <Archive className="size-3.5" />
                  Archive
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Delete policy
              </Button>
            </div>
          </SidebarSection>
        </aside>
      </div>
    </div>
  )
}

function SidebarSection({
  title,
  count,
  empty,
  children,
}: {
  title: string
  count?: number
  empty?: string
  children: React.ReactNode
}) {
  const isEmpty =
    empty !== undefined &&
    count !== undefined &&
    count === 0
  return (
    <section className="rounded-lg border bg-card p-4">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {count !== undefined && count > 0 ? (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {count}
          </span>
        ) : null}
      </header>
      {isEmpty ? (
        <p className="text-xs italic text-muted-foreground">{empty}</p>
      ) : (
        children
      )}
    </section>
  )
}
