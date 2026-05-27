import Link from "next/link"
import { Plus, Search, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { courses, formatDate, formatMinutes } from "@/lib/prototype"

const FILTERS = ["All", "Published", "Draft", "Archived"]

export default function AdminCourses() {
  return (
    <PageContainer size="wide">
      <PageHeader
        title="Courses"
        description="Create, organize, and publish your training programs."
        actions={
          <Button render={<Link href="/prototype/admin/courses/new" />}>
            <Plus />
            New course
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search courses…" className="pl-8" />
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
          <Button variant="outline" size="icon-sm" aria-label="More filters">
            <SlidersHorizontal />
          </Button>
        </div>
      </div>

      <SectionCard flush className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Course</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enrollments</TableHead>
              <TableHead className="w-48">Completion</TableHead>
              <TableHead>Published</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((course) => (
              <TableRow key={course.id}>
                <TableCell className="pl-4">
                  <Link
                    href={`/prototype/admin/courses/${course.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {course.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {course.lessonCount} lessons ·{" "}
                    {formatMinutes(course.durationMinutes)}
                  </p>
                </TableCell>
                <TableCell>
                  <StatusBadge status={course.status} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {course.enrollmentCount.toLocaleString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={course.completionRate}
                      className="w-24"
                    />
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {course.completionRate}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(course.publishedAt)}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    render={
                      <Link href={`/prototype/admin/courses/${course.id}`} />
                    }
                  >
                    Edit
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
