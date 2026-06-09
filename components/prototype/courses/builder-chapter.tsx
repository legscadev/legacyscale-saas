"use client"

import { useRef } from "react"
import { ChevronDown, ChevronUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusBadge } from "@/components/prototype/shared/status-badge"
import { lessonIcon } from "./lesson-type-badge"
import type { Chapter, Lesson, LessonType } from "@/lib/prototype"

const LESSON_TYPES: { type: LessonType; label: string }[] = [
  { type: "VIDEO", label: "Video" },
  { type: "QUIZ", label: "Quiz" },
  { type: "RESOURCE", label: "Resource" },
]

export interface BuilderChapterProps {
  chapter: Chapter
  index: number
  total: number
  onRename: (title: string) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  onAddLesson: (type: LessonType) => void
  onRenameLesson: (lessonId: string, title: string) => void
  onRemoveLesson: (lessonId: string) => void
  onMoveLesson: (from: number, to: number) => void
  onEditLesson: (lesson: Lesson) => void
}

const reorderBtn =
  "text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"

export function BuilderChapter(props: BuilderChapterProps) {
  const { chapter, index, total } = props
  const dragIndex = useRef<number | null>(null)

  return (
    <Card className="gap-0 p-0">
      <div className="flex items-center gap-2 border-b p-2.5">
        <div className="flex flex-col">
          <button
            disabled={index === 0}
            onClick={() => props.onMove(-1)}
            aria-label="Move chapter up"
            className={reorderBtn}
          >
            <ChevronUp className="size-3.5" />
          </button>
          <button
            disabled={index === total - 1}
            onClick={() => props.onMove(1)}
            aria-label="Move chapter down"
            className={reorderBtn}
          >
            <ChevronDown className="size-3.5" />
          </button>
        </div>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        <Input
          value={chapter.title}
          onChange={(e) => props.onRename(e.target.value)}
          placeholder="Chapter title"
          className="h-7 flex-1 border-0 bg-transparent px-1 font-medium focus-visible:ring-1"
        />
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {chapter.lessons.length} lessons
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              />
            }
          >
            <Plus />
            Add lesson
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {LESSON_TYPES.map((t) => {
              const Icon = lessonIcon(t.type)
              return (
                <DropdownMenuItem
                  key={t.type}
                  onClick={() => props.onAddLesson(t.type)}
                >
                  <Icon />
                  {t.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete chapter"
          onClick={props.onRemove}
        >
          <Trash2 />
        </Button>
      </div>

      {chapter.lessons.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No lessons yet — use “Add lesson”.
        </p>
      ) : (
        <ul className="divide-y">
          {chapter.lessons.map((lesson, i) => {
            const Icon = lessonIcon(lesson.type)
            return (
              <li
                key={lesson.id}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={() => {
                  const from = dragIndex.current
                  if (from !== null && from !== i) {
                    props.onMoveLesson(from, i)
                    dragIndex.current = i
                  }
                }}
                className="flex items-center gap-2 px-2.5 py-1.5"
              >
                <span
                  draggable
                  onDragStart={() => (dragIndex.current = i)}
                  onDragEnd={() => (dragIndex.current = null)}
                  aria-hidden
                  className="cursor-grab text-muted-foreground active:cursor-grabbing"
                >
                  <GripVertical className="size-4" />
                </span>
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  value={lesson.title}
                  onChange={(e) => props.onRenameLesson(lesson.id, e.target.value)}
                  placeholder="Lesson title"
                  className="h-7 flex-1 border-0 bg-transparent px-1 text-sm focus-visible:ring-1"
                />
                <StatusBadge status={lesson.status} />
                <div className="flex flex-col">
                  <button
                    disabled={i === 0}
                    onClick={() => props.onMoveLesson(i, i - 1)}
                    aria-label="Move lesson up"
                    className={reorderBtn}
                  >
                    <ChevronUp className="size-3" />
                  </button>
                  <button
                    disabled={i === chapter.lessons.length - 1}
                    onClick={() => props.onMoveLesson(i, i + 1)}
                    aria-label="Move lesson down"
                    className={reorderBtn}
                  >
                    <ChevronDown className="size-3" />
                  </button>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Edit lesson"
                  onClick={() => props.onEditLesson(lesson)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete lesson"
                  onClick={() => props.onRemoveLesson(lesson.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
