import Link from "next/link"
import { ArrowRight, Clock, PlayCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { formatMinutes, type Course } from "@/lib/prototype"

interface CourseCardProps {
  course: Course
  progressPercent?: number
  index?: number
}

export function CourseCard({
  course,
  progressPercent,
  index = 0,
}: CourseCardProps) {
  const enrolled = typeof progressPercent === "number"
  const started = enrolled && progressPercent > 0
  const href = `/prototype/member/courses/${course.id}`

  return (
    <Card
      className="group gap-0 overflow-hidden p-0 transition-all hover:-translate-y-1 hover:ring-primary/30 hover:shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: "backwards" }}
    >
      <Link href={href} className="block">
        <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700">
          <PlayCircle className="size-9 text-white/90 transition-transform group-hover:scale-110" />
          <span className="absolute right-2 top-2 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            {course.accessDays ? `${course.accessDays}-day access` : "Lifetime"}
          </span>
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link href={href}>
          <h3 className="line-clamp-1 font-medium transition-colors group-hover:text-primary">
            {course.title}
          </h3>
        </Link>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {course.description}
        </p>

        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{course.lessonCount} lessons</span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatMinutes(course.durationMinutes)}
          </span>
        </div>

        {enrolled ? (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium tabular-nums">
                {progressPercent}%
              </span>
            </div>
            <Progress value={progressPercent} />
          </div>
        ) : null}

        <Button
          variant={enrolled ? "default" : "outline"}
          className={cn("mt-4 w-full")}
          render={<Link href={href} />}
        >
          {started ? "Continue" : enrolled ? "Start course" : "View course"}
          <ArrowRight />
        </Button>
      </div>
    </Card>
  )
}
