import { CheckCheck, Megaphone } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PageContainer } from "@/components/prototype/shared/page-container"
import { PageHeader } from "@/components/prototype/shared/page-header"
import { SectionCard } from "@/components/prototype/shared/section-card"
import { EmptyState } from "@/components/prototype/shared/empty-state"
import { announcements, relativeTime } from "@/lib/prototype"

export default function MemberNotifications() {
  const feed = announcements.filter((a) => a.status === "PUBLISHED")
  const unread = feed.filter((a) => !a.read).length

  return (
    <PageContainer>
      <PageHeader
        title="Notifications"
        description={
          unread > 0 ? `You have ${unread} unread updates.` : "You're all caught up."
        }
        actions={
          <Button variant="outline">
            <CheckCheck />
            Mark all read
          </Button>
        }
      />

      <SectionCard flush className="mt-6">
        {feed.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No notifications yet"
            description="Announcements from your instructors will appear here."
          />
        ) : (
          <ul className="divide-y">
            {feed.map((a) => (
              <li
                key={a.id}
                className={cn(
                  "flex gap-3 px-4 py-4",
                  !a.read && "bg-primary/[0.03]"
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Megaphone className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{a.title}</p>
                    {!a.read ? (
                      <span className="size-1.5 rounded-full bg-primary" />
                    ) : null}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {a.body}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.publishedAt ? relativeTime(a.publishedAt) : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageContainer>
  )
}
