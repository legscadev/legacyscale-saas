import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Megaphone } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { BadgeDraft, BadgePublished, BadgeScheduled } from './badge-status'

interface AnnouncementCardProps {
  announcement: {
    id: string
    title: string
    body: string
    status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED'
    publishedAt?: Date | null
    createdAt: Date
    author?: {
      name: string | null
      email: string
      avatarUrl: string | null
      role?: 'ADMIN' | 'TEAM' | 'MEMBER' | null
    } | null
  }
  /** Detail-page link target. When set, the title becomes a link to
   *  it. Member feed passes /announcements/[id]; the detail page
   *  itself omits this. */
  href?: string
  className?: string
}

type AuthorRole = NonNullable<
  NonNullable<AnnouncementCardProps['announcement']['author']>['role']
>

function roleLabel(role: AuthorRole | null | undefined): string | null {
  if (role === 'ADMIN') return 'Admin'
  if (role === 'TEAM') return 'Team'
  return null
}

const ROLE_BADGE_CLASS =
  'inline-flex h-4 items-center rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary'

function formatPostedDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function authorInitials(author: { name: string | null; email: string }): string {
  const source = (author.name?.trim() || author.email).trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export function AnnouncementCard({
  announcement,
  href,
  className,
}: AnnouncementCardProps) {
  const date = announcement.publishedAt ?? announcement.createdAt
  const author = announcement.author ?? null
  const authorName = author?.name?.trim() || author?.email || null

  const titleNode = href ? (
    <Link
      href={href}
      className="truncate text-base font-semibold leading-tight transition-colors hover:text-primary hover:underline underline-offset-2"
    >
      {announcement.title}
    </Link>
  ) : (
    <CardTitle className="truncate text-base leading-tight">
      {announcement.title}
    </CardTitle>
  )

  return (
    <Card
      className={cn(
        'gap-0 overflow-hidden p-0 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5',
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b bg-muted/30 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          {author ? (
            <div
              className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary"
              aria-hidden="true"
            >
              {author.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={author.avatarUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                authorInitials(author)
              )}
            </div>
          ) : (
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10">
              <Megaphone className="size-4 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            {titleNode}
            <p
              className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"
              suppressHydrationWarning
            >
              {authorName ? (
                <>
                  <span>{authorName}</span>
                  {(() => {
                    const label = roleLabel(author?.role)
                    return label ? (
                      <span className={ROLE_BADGE_CLASS}>{label}</span>
                    ) : null
                  })()}
                  <span>·</span>
                </>
              ) : null}
              <span>Posted {formatPostedDate(date)}</span>
            </p>
          </div>
        </div>
        {announcement.status === 'PUBLISHED' ? (
          <BadgePublished />
        ) : announcement.status === 'SCHEDULED' ? (
          <BadgeScheduled />
        ) : (
          <BadgeDraft />
        )}
      </CardHeader>
      <CardContent className="px-5 py-4">
        {/* TipTap output rendered as HTML so the admin's formatting
            (bold, italics, headings, lists, links, line breaks) shows
            up on the member side. The editor's whitelist is the
            sanitizer — same pattern the course detail page uses. */}
        <div
          className={cn(
            'text-sm text-foreground/90',
            '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
            '[&_strong]:font-semibold [&_strong]:text-foreground',
            '[&_em]:italic',
            '[&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground',
            '[&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground',
            '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
            '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
            '[&_li]:my-0.5',
            '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic',
            '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
          )}
          dangerouslySetInnerHTML={{ __html: announcement.body }}
        />
        <p
          className="mt-4 border-t pt-3 text-xs text-muted-foreground"
          suppressHydrationWarning
        >
          {formatDistanceToNow(date, { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  )
}
