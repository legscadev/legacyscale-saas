import Link from "next/link"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { InviteMemberDialog } from "@/components/prototype/members/invite-member-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { enrollments, initials, members, relativeTime } from "@/lib/prototype"

const FILTERS = ["All", "Active", "Admins", "Revoked"]

function enrollmentCount(userId: string): number {
  return enrollments.filter((e) => e.user.id === userId).length
}

export default function AdminMembers() {
  return (
    <PageContainer size="wide">
      <PageHeader
        title="Members"
        description="Everyone with access to your platform."
        actions={<InviteMemberDialog />}
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search members…" className="pl-8" />
        </div>
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f, i) => (
            <button
              key={f}
              className={
                i === 0
                  ? "rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                  : "rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <SectionCard flush className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enrollments</TableHead>
              <TableHead>Last active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="pl-4">
                  <Link
                    href={`/prototype/admin/members/${m.id}`}
                    className="flex items-center gap-3"
                  >
                    <Avatar size="sm">
                      <AvatarFallback>{initials(m.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium hover:text-primary">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge status={m.role} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={m.isActive ? "ACTIVE" : "REVOKED"} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {enrollmentCount(m.id)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {m.lastLoginAt ? relativeTime(m.lastLoginAt) : "Never"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </PageContainer>
  )
}
