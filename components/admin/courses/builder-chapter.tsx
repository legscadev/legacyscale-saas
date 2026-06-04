'use client'

import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
import { LessonTypeIcon } from './lesson-type'
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

const dragHandleBtn =
  'cursor-grab text-muted-foreground/60 transition-colors hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30'

export interface BuilderChapterProps {
  chapter: ChapterListItem
  index: number
  total: number
  // Chapter ops — control is enabled iff the corresponding handler is
  // supplied. Lets the parent gate features by simply not passing the
  // handler instead of threading a `disabled` flag.
  onRename?: (title: string) => void
  onRemove?: () => void
  onMove?: (dir: -1 | 1) => void
  // Lesson ops — same pattern; missing handler → disabled control.
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

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: chapter.id,
    data: { type: 'chapter' as const },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'gap-0 p-0 transition-shadow',
        isDragging && 'z-10 shadow-lg ring-1 ring-primary/30',
      )}
    >
      <div className="flex items-center gap-2 border-b p-2.5">
        <button
          ref={setActivatorNodeRef}
          type="button"
          disabled={!onMove}
          aria-label="Drag chapter to reorder"
          {...attributes}
          {...listeners}
          className={dragHandleBtn}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="flex flex-col">
          <button
            type="button"
            disabled={index === 0 || !onMove}
            onClick={() => onMove?.(-1)}
            aria-label="Move chapter up"
            className={reorderBtn}
          >
            <ChevronUp className="size-3.5" />
          </button>
          <button
            type="button"
            disabled={index === total - 1 || !onMove}
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
          disabled={!onRename}
          className="h-7 flex-1 border-0 bg-transparent px-1 font-medium focus-visible:ring-1"
        />
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={!onAddLesson}
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
            {LESSON_TYPES.map((t) => (
              <DropdownMenuItem
                key={t.type}
                onClick={() => onAddLesson?.(t.type)}
              >
                <LessonTypeIcon type={t.type} />
                {t.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Delete chapter"
          disabled={!onRemove}
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
        <SortableContext
          items={lessons.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="divide-y">
            {lessons.map((lesson, i) => (
              <SortableLessonRow
                key={lesson.id}
                lesson={lesson}
                chapterId={chapter.id}
                index={i}
                total={lessons.length}
                onRename={
                  onRenameLesson
                    ? (title) => onRenameLesson(lesson.id, title)
                    : undefined
                }
                onMove={
                  onMoveLesson
                    ? (dir) => onMoveLesson(i, i + dir)
                    : undefined
                }
                onEdit={onEditLesson ? () => onEditLesson(lesson) : undefined}
                onRemove={
                  onRemoveLesson ? () => onRemoveLesson(lesson.id) : undefined
                }
              />
            ))}
          </ul>
        </SortableContext>
      )}
    </Card>
  )
}

interface SortableLessonRowProps {
  lesson: LessonListItem
  chapterId: string
  index: number
  total: number
  onRename?: (title: string) => void
  onMove?: (dir: -1 | 1) => void
  onEdit?: () => void
  onRemove?: () => void
}

function SortableLessonRow({
  lesson,
  chapterId,
  index,
  total,
  onRename,
  onMove,
  onEdit,
  onRemove,
}: SortableLessonRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lesson.id,
    data: { type: 'lesson' as const, chapterId },
  })

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'flex items-center gap-2 bg-card px-2.5 py-1.5',
        isDragging && 'z-10 shadow-md ring-1 ring-primary/30',
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        disabled={!onMove}
        aria-label="Drag lesson to reorder"
        {...attributes}
        {...listeners}
        className={dragHandleBtn}
      >
        <GripVertical className="size-4" />
      </button>
      <LessonTypeIcon
        type={lesson.type}
        className="size-4 shrink-0 text-muted-foreground"
      />
      <Input
        value={lesson.title}
        onChange={(e) => onRename?.(e.target.value)}
        placeholder="Lesson title"
        disabled={!onRename}
        className="h-7 flex-1 border-0 bg-transparent px-1 text-sm focus-visible:ring-1"
      />
      <StatusBadge status={lesson.status} />
      <div className="flex flex-col">
        <button
          type="button"
          disabled={index === 0 || !onMove}
          onClick={() => onMove?.(-1)}
          aria-label="Move lesson up"
          className={reorderBtn}
        >
          <ChevronUp className="size-3" />
        </button>
        <button
          type="button"
          disabled={index === total - 1 || !onMove}
          onClick={() => onMove?.(1)}
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
        disabled={!onEdit}
        onClick={onEdit}
      >
        <Pencil />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Delete lesson"
        disabled={!onRemove}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </li>
  )
}
