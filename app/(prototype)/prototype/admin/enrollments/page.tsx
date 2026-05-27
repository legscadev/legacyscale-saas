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
import { ManualEnrollDialog } from "@/components/prototype/enrollments/manual-enroll-dialog"
import {
  enrollments,
  formatDate,
  type EnrollmentSource,
} from "@/lib/prototype"

const SOURCE_LABEL: Record<EnrollmentSource, string> = {
  GHL_WEBHOOK: "GoHighLevel",
  MANUAL: "Manual",
  ADMIN: "Admin",
  SELF_ENROLL: "Self-enroll",
}

const STATUS_FILTERS = ["All", "Active", "Pending", "Expired", "Revoked"]

export default function AdminEnrollments() {
  const counts = {
    active: enrollments.filter((e) => e.status === "ACTIVE").length,
    pending: enrollments.filter((e) => e.status === "PENDING").length,
    expired: enrollments.filter((e) => e.status === "EXPIRED").length,
    revoked: enrollments.filter((e) => e.status === "REVOKED").length,
  }

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Enrollments"
        description="Manage course access. Most members are enrolled automatically via GoHighLevel."
        actions={<ManualEnrollDialog />}
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active" value={counts.active} tone="text-success" />
        <Stat label="Pending" value={counts.pending} tone="text-warning" />
        <Stat label="Expired" value={counts.expired} tone="text-muted-foreground" />
        <Stat label="Revoked" value={counts.revoked} tone="text-error" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {STATUS_FILTERS.map((f, i) => (
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

      <SectionCard flush className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Member</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-40">Progress</TableHead>
              <TableHead>Enrolled</TableHead>
              <TableHead>Expires</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrollments.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="pl-4">
                  <p className="font-medium">{e.user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.user.email}
                  </p>
                </TableCell>
                <TableCell className="max-w-48 truncate text-sm">
                  {e.course.title}
                </TableCell>
                <TableCell>
                  <StatusBadge status={e.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {SOURCE_LABEL[e.source]}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={e.progressPercent} className="w-20" />
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {e.progressPercent}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(e.enrolledAt)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {e.expiresAt ? formatDate(e.expiresAt) : "Lifetime"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </PageContainer>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className={`text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
