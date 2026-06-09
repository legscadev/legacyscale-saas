import Link from "next/link"
import { Pencil, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageContainer } from "@/components/prototype/shared/page-container"
import { PageHeader } from "@/components/prototype/shared/page-header"
import { SectionCard } from "@/components/prototype/shared/section-card"
import { StatusBadge } from "@/components/prototype/shared/status-badge"
import { announcements, formatDate } from "@/lib/prototype"

export default function AdminAnnouncements() {
  return (
    <PageContainer size="wide">
      <PageHeader
        title="Announcements"
        description="Broadcast updates to your members and track reach."
        actions={
          <Button render={<Link href="/prototype/admin/announcements/new" />}>
            <Plus />
            New announcement
          </Button>
        }
      />

      <SectionCard flush className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published</TableHead>
              <TableHead className="w-48">Read rate</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {announcements.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="max-w-md pl-4">
                  <Link
                    href={`/prototype/admin/announcements/${a.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {a.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={a.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(a.publishedAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={a.readRate} className="w-24" />
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {a.readRate}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit announcement"
                    render={
                      <Link href={`/prototype/admin/announcements/${a.id}`} />
                    }
                  >
                    <Pencil />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </PageContainer>
  )
}
