'use client'

import { ChevronDown, ChevronUp, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { StatusBadge } from '@/components/shared'
import { lessonTypeIcon } from './lesson-type'
import type {
  ChapterListItem,
  LessonListItem,
} from '@/lib/services/chapter-service'
import type { LessonType } from '@prisma/client'

const LESSON_TYPES: { type: LessonType; label: string }[] = [
  { type: 'VIDEO', label: 'Video' },
  { type: 'QUIZ', label: 'Quiz' },
  { type: 'RESOURCE', label: 'Resource' },
]

const reorderBtn =
  'text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30'

export interface BuilderChapterProps {
  chapter: ChapterListItem
  index: number
  total: number
  /** Disabled while operations land in the next ticket. */
  disabled?: boolean
  onRename?: (title: string) => void
  onRemove?: () => void
  onMove?: (dir: -1 | 1) => void
  onAddLesson?: (type: LessonType) => void
  onRenameLesson?: (lessonId: string, title: string) => void
  onRemoveLesson?: (lessonId: string) => void
  onMoveLesson?: (from: number, to: number) => void
  onEditLesson?: (lesson: LessonListItem) => void
}

export function BuilderChapter({
  chapter,
  index,
  total,
  disabled = false,
  onRename,
  onRemove,
  onMove,
  onAddLesson,
  onRenameLesson,
  onRemoveLesson,
  onMoveLesson,
  onEditLesson,
}: BuilderChapterProps) {
  const lessons = chapter.lessons
  const noop = disabled || !onRename

  return (
    <Card className="gap-0 p-0">
      <div className="flex items-center gap-2 border-b p-2.5">
        <div className="flex flex-col">
          <button
            type="button"
            disabled={index === 0 || disabled}
            onClick={() => onMove?.(-1)}
            aria-label="Move chapter up"
            className={reorderBtn}
          >
            <ChevronUp className="size-3.5" />
          </button>
          <button
            type="button"
            disabled={index === total - 1 || disabled}
            onClick={() => onMove?.(1)}
            aria-label="Move chapter down"
            className={reorderBtn}
          >
            <ChevronDown className="size-3.5" />
          </button>
        </div>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {String(index + 1).padStart(2, '0')}
        </span>
        <Input
          value={chapter.title}
          onChange={(e) => onRename?.(e.target.value)}
          placeholder="Chapter title"
          disabled={noop}
          className="h-7 flex-1 border-0 bg-transparent px-1 font-medium focus-visible:ring-1"
        />
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={disabled}
            render={
              <button
                type="button"
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
              />
            }
          >
            <Plus />
            Add lesson
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {LESSON_TYPES.map((t) => {
              const Icon = lessonTypeIcon(t.type)
              return (
                <DropdownMenuItem
                  key={t.type}
                  disabled={!onAddLesson}
                  onClick={() => onAddLesson?.(t.type)}
                >
                  <Icon />
                  {t.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Delete chapter"
          disabled={disabled}
          onClick={() => onRemove?.()}
        >
          <Trash2 />
        </Button>
      </div>

      {lessons.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No lessons yet — use “Add lesson”.
        </p>
      ) : (
        <ul className="divide-y">
          {lessons.map((lesson, i) => {
            const Icon = lessonTypeIcon(lesson.type)
            return (
              <li
                key={lesson.id}
                className="flex items-center gap-2 px-2.5 py-1.5"
              >
                <span aria-hidden className="text-muted-foreground">
                  <GripVertical className="size-4" />
                </span>
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  value={lesson.title}
                  onChange={(e) =>
                    onRenameLesson?.(lesson.id, e.target.value)
                  }
                  placeholder="Lesson title"
                  disabled={noop}
                  className="h-7 flex-1 border-0 bg-transparent px-1 text-sm focus-visible:ring-1"
                />
                <StatusBadge status={lesson.status} />
                <div className="flex flex-col">
                  <button
                    type="button"
                    disabled={i === 0 || disabled}
                    onClick={() => onMoveLesson?.(i, i - 1)}
                    aria-label="Move lesson up"
                    className={reorderBtn}
                  >
                    <ChevronUp className="size-3" />
                  </button>
                  <button
                    type="button"
                    disabled={i === lessons.length - 1 || disabled}
                    onClick={() => onMoveLesson?.(i, i + 1)}
                    aria-label="Move lesson down"
                    className={reorderBtn}
                  >
                    <ChevronDown className="size-3" />
                  </button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Edit lesson"
                  disabled={disabled}
                  onClick={() => onEditLesson?.(lesson)}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete lesson"
                  disabled={disabled}
                  onClick={() => onRemoveLesson?.(lesson.id)}
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
