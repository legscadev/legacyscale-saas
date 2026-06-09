import Link from "next/link"
import { Award, BookOpen, CheckCircle2, Flame, Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { PageContainer } from "@/components/prototype/shared/page-container"
import { SectionCard } from "@/components/prototype/shared/section-card"
import { ActivityFeed } from "@/components/prototype/shared/activity-feed"
import { CourseCard } from "@/components/prototype/member/course-card"
import {
  announcements,
  courses,
  currentMember,
  findLesson,
  flagshipCourse,
  formatDuration,
  memberActivity,
  relativeTime,
} from "@/lib/prototype"

const STATS = [
  { label: "Courses enrolled", value: "2", icon: BookOpen },
  { label: "Lessons completed", value: "5", icon: CheckCircle2 },
  { label: "Quizzes passed", value: "1", icon: Award },
  { label: "Day streak", value: "6", icon: Flame },
]

export default function MemberDashboard() {
  const resume = findLesson("l-5")
  const remaining =
    resume?.lesson.durationSeconds && resume.lesson.lastPositionSec
      ? resume.lesson.durationSeconds - resume.lesson.lastPositionSec
      : 0
  const published = announcements
    .filter((a) => a.status === "PUBLISHED")
    .slice(0, 3)

  return (
    <PageContainer size="wide">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {currentMember.name.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          Pick up where you left off and keep your momentum going.
        </p>
      </div>

      {resume ? (
        <Card className="mt-6 gap-0 overflow-hidden p-0">
          <div className="grid gap-0 md:grid-cols-[1fr_auto]">
            <div className="p-6">
              <span className="text-xs font-medium uppercase tracking-wider text-primary">
                Continue learning
              </span>
              <h2 className="mt-2 text-xl font-semibold">
                {resume.lesson.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {resume.course.title} · {resume.chapter.title}
              </p>
              <div className="mt-4 max-w-md space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{resume.lesson.watchedPercent}% watched</span>
                  <span>{formatDuration(remaining)} left</span>
                </div>
                <Progress value={resume.lesson.watchedPercent ?? 0} />
              </div>
              <Button
                className="mt-5"
                size="lg"
                render={
                  <Link href={`/prototype/member/learn/${resume.lesson.id}`} />
                }
              >
                <Play />
                Resume lesson
              </Button>
            </div>
            <div className="hidden w-64 items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 md:flex">
              <Play className="size-12 text-white/90" />
            </div>
          </div>
        </Card>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map((s) => (
          <Card key={s.label} className="gap-0 p-4">
            <s.icon className="size-4 text-muted-foreground" />
            <p className="mt-3 text-2xl font-semibold tabular-nums">
              {s.value}
            </p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">My courses</h2>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/prototype/member/courses" />}
            >
              View all
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CourseCard course={flagshipCourse} progressPercent={38} index={0} />
            <CourseCard course={courses[1]} progressPercent={12} index={1} />
          </div>
        </div>

        <div className="space-y-4">
          <SectionCard
            title="Announcements"
            action={
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/prototype/member/notifications" />}
              >
                All
              </Button>
            }
            flush
          >
            <ul className="divide-y">
              {published.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    {!a.read ? (
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    ) : (
                      <span className="mt-1.5 size-1.5 shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium leading-snug">
                        {a.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.publishedAt ? relativeTime(a.publishedAt) : ""}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Your activity">
            <ActivityFeed items={memberActivity.slice(0, 4)} />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  )
}
