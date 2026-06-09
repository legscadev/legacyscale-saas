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
import { ActivityFeed } from "@/components/prototype/shared/activity-feed"
import { formatDate, memberActivity, memberQuizAttempts } from "@/lib/prototype"

export default function MemberActivity() {
  return (
    <PageContainer>
      <PageHeader
        title="Activity"
        description="Your learning history and quiz results."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Recent activity">
          <ActivityFeed items={memberActivity} />
        </SectionCard>

        <SectionCard title="Quiz history" flush>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Quiz</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="pr-4">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberQuizAttempts.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="pl-4 text-sm">{q.lessonTitle}</TableCell>
                  <TableCell className="tabular-nums text-sm">
                    {q.score}/{q.total}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={q.passed ? "ACTIVE" : "REVOKED"}
                      label={q.passed ? "Passed" : "Failed"}
                    />
                  </TableCell>
                  <TableCell className="pr-4 text-sm text-muted-foreground">
                    {formatDate(q.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      </div>
    </PageContainer>
  )
}
