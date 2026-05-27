import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PageContainer } from "@/components/prototype/shared/page-container"
import { PageHeader } from "@/components/prototype/shared/page-header"
import { StatusBadge } from "@/components/prototype/shared/status-badge"
import { ProgressRing } from "@/components/prototype/shared/progress-ring"
import { announcements } from "@/lib/prototype"

export default async function AnnouncementEditor({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const existing = announcements.find((a) => a.id === id)

  return (
    <PageContainer size="wide">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        render={<Link href="/prototype/admin/announcements" />}
      >
        <ArrowLeft />
        Announcements
      </Button>

      <PageHeader
        className="mt-2"
        title={existing ? "Edit announcement" : "New announcement"}
        description="Compose your message and publish to all members."
        actions={
          <>
            <Button variant="outline">Save draft</Button>
            <Button>Publish</Button>
          </>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="gap-4 p-5">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              defaultValue={existing?.title}
              placeholder="A short, clear headline"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <Textarea
              defaultValue={existing?.body}
              placeholder="Write your announcement…"
              className="min-h-48"
            />
          </div>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="gap-3 p-5">
            <p className="text-sm font-semibold">Status</p>
            <StatusBadge status={existing?.status ?? "DRAFT"} />
            <p className="text-xs text-muted-foreground">
              Drafts are only visible to admins until published.
            </p>
          </Card>

          {existing && existing.status === "PUBLISHED" ? (
            <Card className="items-center gap-3 p-5 text-center">
              <p className="self-start text-sm font-semibold">Read analytics</p>
              <ProgressRing value={existing.readRate} size={96} />
              <p className="text-xs text-muted-foreground">
                {existing.readRate}% of members have opened this announcement.
              </p>
            </Card>
          ) : null}
        </aside>
      </div>
    </PageContainer>
  )
}
