import Link from "next/link"
import { CheckCircle2, Circle, Lock } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  formatDuration,
  formatFileSize,
  type Chapter,
  type Lesson,
} from "@/lib/prototype"
import { lessonIcon } from "./lesson-type-badge"

function lessonMeta(lesson: Lesson): string {
  if (lesson.type === "VIDEO" && lesson.durationSeconds) {
    return formatDuration(lesson.durationSeconds)
  }
  if (lesson.type === "QUIZ") {
    return `${lesson.questions?.length ?? 0} questions · ${lesson.passingScore}% to pass`
  }
  if (lesson.type === "RESOURCE" && lesson.resourceSize) {
    return `${lesson.resourceName} · ${formatFileSize(lesson.resourceSize)}`
  }
  return ""
}

interface CurriculumOutlineProps {
  chapters: Chapter[]
  courseId: string
  activeLessonId?: string
  variant?: "page" | "sidebar"
}

export function CurriculumOutline({
  chapters,
  activeLessonId,
  variant = "page",
}: CurriculumOutlineProps) {
  const sidebar = variant === "sidebar"

  return (
    <div className={cn("flex flex-col", sidebar ? "gap-4" : "gap-6")}>
      {chapters.map((chapter, ci) => (
        <div key={chapter.id}>
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className={cn("font-medium", sidebar ? "text-sm" : "text-sm")}>
              <span className="text-muted-foreground">
                {String(ci + 1).padStart(2, "0")}
              </span>{" "}
              {chapter.title}
            </h3>
            <span className="text-xs text-muted-foreground">
              {chapter.lessons.length} lessons
            </span>
          </div>
          <ul className={cn(!sidebar && "rounded-xl border")}>
            {chapter.lessons.map((lesson, li) => {
              const Icon = lessonIcon(lesson.type)
              const active = lesson.id === activeLessonId
              const locked = lesson.status !== "READY"
              return (
                <li key={lesson.id}>
                  <Link
                    href={`/prototype/member/learn/${lesson.id}`}
                    scroll={variant !== "sidebar"}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                      !sidebar && li > 0 && "border-t",
                      sidebar && "rounded-lg",
                      active
                        ? "bg-primary/10 text-foreground"
                        : "hover:bg-muted/60"
                    )}
                  >
                    {lesson.completed ? (
                      <CheckCircle2 className="size-4 shrink-0 text-success" />
                    ) : locked ? (
                      <Lock className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate",
                          active && "font-medium text-primary"
                        )}
                      >
                        {lesson.title}
                      </p>
                      <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <Icon className="size-3" />
                        {lessonMeta(lesson)}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
