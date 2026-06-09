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
        <p className="line-clamp-3 text-sm text-muted-foreground">
          {announcement.body}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          {formatDistanceToNow(date, { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  )
}
