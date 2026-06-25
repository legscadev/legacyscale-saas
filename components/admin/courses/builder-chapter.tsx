'use client'

import { useState } from 'react'
import MuxPlayer from '@mux/mux-player-react'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  FileText,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
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
import { getResourceDownloadUrlAction } from '@/app/(admin)/admin/courses/[slug]/actions'
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
  const [collapsed, setCollapsed] = useState(false)

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
      <div
        className={cn(
          'flex items-center gap-2 bg-muted/40 p-2.5',
          !collapsed && 'border-b',
        )}
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand chapter' : 'Collapse chapter'}
          aria-expanded={!collapsed}
          className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>
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
                onClick={() => {
                  // Auto-expand so the new row doesn't get hidden
                  // behind a collapsed chapter.
                  setCollapsed(false)
                  onAddLesson?.(t.type)
                }}
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

      {collapsed ? null : lessons.length === 0 ? (
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

  const [expanded, setExpanded] = useState(false)

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'flex flex-col bg-card',
        isDragging && 'z-10 shadow-md ring-1 ring-primary/30',
      )}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? 'Collapse lesson' : 'Expand lesson'}
          aria-expanded={expanded}
          className="grid size-5 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </button>
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
      </div>

      {expanded ? <LessonPreview lesson={lesson} /> : null}
    </li>
  )
}

// ============================================================
// Expanded preview — type-specific glance at the lesson's content
// ============================================================

function LessonPreview({ lesson }: { lesson: LessonListItem }) {
  const hasDescription = Boolean(lesson.description?.trim())
  return (
    <div className="space-y-3 border-t bg-muted/20 px-9 py-3 text-sm">
      {hasDescription ? (
        <div
          className={cn(
            'text-muted-foreground',
            '[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
            '[&_ul]:my-1 [&_ul]:pl-5 [&_ul]:list-disc',
            '[&_ol]:my-1 [&_ol]:pl-5 [&_ol]:list-decimal',
            '[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-0.5',
            '[&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-0.5',
            '[&_a]:text-primary [&_a]:underline',
            '[&_strong]:font-semibold [&_em]:italic',
            '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:my-1',
          )}
          dangerouslySetInnerHTML={{ __html: lesson.description ?? '' }}
        />
      ) : (
        <p className="italic text-muted-foreground/60">
          No description.
        </p>
      )}

      {lesson.type === 'VIDEO' ? <VideoPreview lesson={lesson} /> : null}
      {lesson.type === 'RESOURCE' ? <ResourcePreview lesson={lesson} /> : null}
      {lesson.type === 'QUIZ' ? (
        <p className="italic text-muted-foreground/60">
          Quiz questions editor lands in a later ticket.
        </p>
      ) : null}
    </div>
  )
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function VideoPreview({ lesson }: { lesson: LessonListItem }) {
  if (lesson.status === 'READY' && lesson.muxPlaybackId) {
    return (
      <div className="space-y-1">
        <div className="mx-auto overflow-hidden rounded-md bg-black">
          <MuxPlayer
            playbackId={lesson.muxPlaybackId}
            streamType="on-demand"
            metadata={{ video_title: lesson.title }}
            style={{ aspectRatio: '16 / 9', width: '100%' }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Duration: {formatDuration(lesson.durationSeconds)}
        </p>
      </div>
    )
  }
  if (lesson.status === 'PROCESSING') {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Video is processing on Mux.
      </p>
    )
  }
  return (
    <p className="text-xs italic text-muted-foreground/60">
      No video uploaded yet — use the edit dialog.
    </p>
  )
}

function ResourcePreview({ lesson }: { lesson: LessonListItem }) {
  if (lesson.resources.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground/60">
        No files attached yet — use the edit dialog.
      </p>
    )
  }
  return (
    <ul className="space-y-1">
      {lesson.resources.map((r) => (
        <li
          key={r.id}
          className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5"
        >
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-xs">{r.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatFileSize(r.size)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Download ${r.name}`}
            onClick={() => void downloadResource(r.id)}
          >
            <Download className="size-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  )
}

async function downloadResource(resourceId: string): Promise<void> {
  const result = await getResourceDownloadUrlAction(resourceId)
  if (!result.ok || !result.url) {
    toast.error(result.error ?? 'Could not generate download link')
    return
  }
  window.open(result.url, '_blank', 'noopener,noreferrer')
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
