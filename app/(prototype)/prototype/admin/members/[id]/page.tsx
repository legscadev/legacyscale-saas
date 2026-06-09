import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ShieldCheck, UserX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageContainer } from "@/components/prototype/shared/page-container"
import { SectionCard } from "@/components/prototype/shared/section-card"
import { StatusBadge } from "@/components/prototype/shared/status-badge"
import { EmptyState } from "@/components/prototype/shared/empty-state"
import { ActivityFeed } from "@/components/prototype/shared/activity-feed"
import { Ticket } from "lucide-react"
import {
  enrollments,
  findMember,
  formatDate,
  initials,
  memberActivity,
  memberQuizAttempts,
  relativeTime,
} from "@/lib/prototype"

const SOURCE_LABEL: Record<string, string> = {
  GHL_WEBHOOK: "GoHighLevel",
  MANUAL: "Manual",
  ADMIN: "Admin",
  SELF_ENROLL: "Self-enroll",
}

export default async function MemberDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const member = findMember(id)
  if (!member) notFound()

  const memberEnrollments = enrollments.filter((e) => e.user.id === id)

  return (
    <PageContainer size="wide">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        render={<Link href="/prototype/admin/members" />}
      >
        <ArrowLeft />
        Members
      </Button>

      <Card className="mt-2 flex-row flex-wrap items-center gap-4 p-5">
        <Avatar size="lg">
          <AvatarFallback>{initials(member.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{member.name}</h1>
            <StatusBadge status={member.role} />
            <StatusBadge status={member.isActive ? "ACTIVE" : "REVOKED"} />
          </div>
          <p className="text-sm text-muted-foreground">{member.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Joined {formatDate(member.createdAt)}
            {member.lastLoginAt
              ? ` · Last active ${relativeTime(member.lastLoginAt)}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <ShieldCheck />
            Change role
          </Button>
          <Button variant="destructive">
            <UserX />
            Revoke access
          </Button>
        </div>
      </Card>

      <Tabs defaultValue="enrollments" className="mt-6">
        <TabsList>
          <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
          <TabsTrigger value="quizzes">Quiz attempts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="enrollments" className="pt-4">
          {memberEnrollments.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title="No enrollments"
              description="This member hasn't been enrolled in any course yet."
            />
          ) : (
            <SectionCard flush>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Course</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="w-40">Progress</TableHead>
                    <TableHead>Enrolled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberEnrollments.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="pl-4 text-sm">
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
                          <Progress
                            value={e.progressPercent}
                            className="w-20"
                          />
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {e.progressPercent}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(e.enrolledAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>
          )}
        </TabsContent>

        <TabsContent value="quizzes" className="pt-4">
          <SectionCard flush>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Quiz</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberQuizAttempts.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="pl-4 text-sm">
                      {q.lessonTitle}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {q.courseTitle}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {q.score}/{q.total}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={q.passed ? "ACTIVE" : "REVOKED"}
                        label={q.passed ? "Passed" : "Failed"}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(q.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="activity" className="pt-4">
          <SectionCard>
            <ActivityFeed items={memberActivity} />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
