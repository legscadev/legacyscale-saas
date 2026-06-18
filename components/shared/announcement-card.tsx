import { formatDistanceToNow } from 'date-fns'
import { Megaphone } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { BadgeDraft, BadgePublished } from './badge-status'

interface AnnouncementCardProps {
  announcement: {
    id: string
    title: string
    body: string
    status: 'DRAFT' | 'PUBLISHED'
    publishedAt?: Date | null
    createdAt: Date
  }
  className?: string
}

export function AnnouncementCard({
  announcement,
  className,
}: AnnouncementCardProps) {
  const date = announcement.publishedAt ?? announcement.createdAt

  return (
    <Card
      className={cn(
        'transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5',
        className
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
              <Megaphone className="size-4 text-primary" />
            </div>
            <CardTitle className="text-base">{announcement.title}</CardTitle>
          </div>
          {announcement.status === 'PUBLISHED' ? (
            <BadgePublished />
          ) : (
            <BadgeDraft />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* TipTap output rendered as HTML so the admin's formatting
            (bold, italics, headings, lists, links, line breaks) shows
            up on the member side. The editor's whitelist is the
            sanitizer — same pattern the course detail page uses. */}
        <div
          className={cn(
            'text-sm text-muted-foreground',
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
        <p className="mt-3 text-xs text-muted-foreground">
          {formatDistanceToNow(date, { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  )
}
