"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Eye, Layers, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PageContainer } from "@/components/prototype/shared/page-container"
import { EmptyState } from "@/components/prototype/shared/empty-state"
import { StatusBadge } from "@/components/prototype/shared/status-badge"
import { BuilderChapter } from "./builder-chapter"
import { LessonEditorDialog } from "./lesson-editor-dialog"
import type { Chapter, Course, CourseStatus, Lesson, LessonType } from "@/lib/prototype"

const STATUSES: CourseStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"]
const TYPE_LABEL: Record<LessonType, string> = {
  VIDEO: "video",
  QUIZ: "quiz",
  RESOURCE: "resource",
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr
  const copy = [...arr]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

function newLesson(chapterId: string, type: LessonType): Lesson {
  const base: Lesson = {
    id: uid("l"),
    chapterId,
    title: `New ${TYPE_LABEL[type]} lesson`,
    type,
    status: "DRAFT",
    orderIndex: 0,
  }
  if (type === "QUIZ") return { ...base, passingScore: 70, maxAttempts: 3, questions: [] }
  if (type === "VIDEO") return { ...base, durationSeconds: 0 }
  return { ...base, resourceName: "resource.pdf" }
}

interface CourseBuilderProps {
  course: Course
  mode?: "new" | "edit"
}

export function CourseBuilder({ course, mode = "edit" }: CourseBuilderProps) {
  const [title, setTitle] = useState(course.title)
  const [description, setDescription] = useState(course.description)
  const [status, setStatus] = useState<CourseStatus>(course.status)
  const [chapters, setChapters] = useState<Chapter[]>(course.chapters)
  const [editing, setEditing] = useState<Lesson | null>(null)

  const lessonCount = chapters.reduce((n, c) => n + c.lessons.length, 0)

  const patch = (chId: string, fn: (c: Chapter) => Chapter) =>
    setChapters((prev) => prev.map((c) => (c.id === chId ? fn(c) : c)))

  const addChapter = () =>
    setChapters((prev) => [
      ...prev,
      { id: uid("ch"), courseId: course.id, title: "New chapter", orderIndex: prev.length, lessons: [] },
    ])

  const onSave = () =>
    toast.success(mode === "new" ? "Course created" : "Changes saved")

  return (
    <PageContainer size="wide">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        render={<Link href="/prototype/admin/courses" />}
      >
        <ArrowLeft />
        Courses
      </Button>

      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {title || "Untitled course"}
          </h1>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" ? (
            <Button
              variant="outline"
              render={<Link href={`/prototype/member/courses/${course.id}`} />}
            >
              <Eye />
              Preview
            </Button>
          ) : null}
          <Button onClick={onSave}>{mode === "new" ? "Create course" : "Save changes"}</Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {chapters.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Start building your course"
              description="Add a chapter, then fill it with video, quiz, and resource lessons. Drag to reorder."
              action={
                <Button onClick={addChapter}>
                  <Plus />
                  Add chapter
                </Button>
              }
            />
          ) : (
            chapters.map((ch, i) => (
              <BuilderChapter
                key={ch.id}
                chapter={ch}
                index={i}
                total={chapters.length}
                onRename={(t) => patch(ch.id, (c) => ({ ...c, title: t }))}
                onRemove={() =>
                  setChapters((prev) => prev.filter((c) => c.id !== ch.id))
                }
                onMove={(dir) => setChapters((prev) => move(prev, i, i + dir))}
                onAddLesson={(type) =>
                  patch(ch.id, (c) => ({
                    ...c,
                    lessons: [...c.lessons, newLesson(ch.id, type)],
                  }))
                }
                onRenameLesson={(lId, t) =>
                  patch(ch.id, (c) => ({
                    ...c,
                    lessons: c.lessons.map((l) =>
                      l.id === lId ? { ...l, title: t } : l
                    ),
                  }))
                }
                onRemoveLesson={(lId) =>
                  patch(ch.id, (c) => ({
                    ...c,
                    lessons: c.lessons.filter((l) => l.id !== lId),
                  }))
                }
                onMoveLesson={(from, to) =>
                  patch(ch.id, (c) => ({ ...c, lessons: move(c.lessons, from, to) }))
                }
                onEditLesson={setEditing}
              />
            ))
          )}

          {chapters.length > 0 ? (
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={addChapter}
            >
              <Plus />
              Add chapter
            </Button>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="gap-4 p-5">
            <p className="text-sm font-semibold">Course details</p>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 7-Figure Agency Program"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What will members learn?"
                className="min-h-24"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="flex gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={
                      s === status
                        ? "flex-1 rounded-md bg-primary/10 px-2 py-1.5 text-xs font-medium text-primary"
                        : "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                    }
                  >
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span>{chapters.length} chapters</span>
              <span>{lessonCount} lessons</span>
            </div>
            <Button className="w-full" onClick={onSave}>
              {mode === "new" ? "Create course" : "Save changes"}
            </Button>
          </Card>
        </aside>
      </div>

      <LessonEditorDialog
        lesson={editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </PageContainer>
  )
}
