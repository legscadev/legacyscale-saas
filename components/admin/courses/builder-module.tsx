'use client'

import {
  ChevronDown,
  ChevronRight,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import type { LessonType } from '@prisma/client'
import { useDroppable } from '@dnd-kit/core'

import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BuilderChapter } from './builder-chapter'
import type {
  ChapterListItem,
  LessonListItem,
} from '@/lib/services/chapter-service'
import type { ModuleListItem } from '@/lib/services/module-service'

interface BuilderModuleProps {
  module: ModuleListItem
  chapters: ChapterListItem[]
  collapsed: boolean
  onToggleCollapsed: () => void
  onEdit: () => void
  onRemove: () => void
  // Chapter ops within this module
  onAddChapter: () => void
  onRenameChapter: (chapterId: string, title: string) => void
  onRemoveChapter: (chapterId: string) => void
  onMoveChapter: (chapterId: string, dir: -1 | 1) => void
  // Lesson ops bubble through the chapter
  onAddLesson: (chapterId: string, type: LessonType) => void
  onRenameLesson: (chapterId: string, lessonId: string, title: string) => void
  onRemoveLesson: (chapterId: string, lessonId: string) => void
  onMoveLesson: (chapterId: string, from: number, to: number) => void
  onEditLesson: (chapterId: string, lesson: LessonListItem) => void
}

export function BuilderModule({
  module,
  chapters,
  collapsed,
  onToggleCollapsed,
  onEdit,
  onRemove,
  onAddChapter,
  onRenameChapter,
  onRemoveChapter,
  onMoveChapter,
  onAddLesson,
  onRenameLesson,
  onRemoveLesson,
  onMoveLesson,
  onEditLesson,
}: BuilderModuleProps) {
  // Module body is a drop target so chapters can be dragged INTO this
  // module — including when it's empty. `id` is the module id; the
  // builder's onDragEnd reads `data.type === 'module-container'` and
  // routes the drop to a cross-scope move that updates moduleId.
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: module.id,
    data: { type: 'module-container' as const },
  })

  return (
    <Card className="gap-0 overflow-hidden border-primary/30 bg-primary/5 p-0">
      {/* Module header */}
      <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/10 px-4 py-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label={collapsed ? 'Expand module' : 'Collapse module'}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>

        <Layers className="size-4 text-primary" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{module.title}</p>
          {module.description ? (
            <p className="truncate text-xs text-muted-foreground">
              {module.description}
            </p>
          ) : null}
        </div>

        <span className="rounded-full bg-background/60 px-2 py-0.5 text-xs text-muted-foreground">
          {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Module actions"
            render={
              <button
                type="button"
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                  'size-7',
                )}
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil />
              Edit module
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onRemove}>
              <Trash2 />
              Delete module
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Module body */}
      {collapsed ? null : (
        <div
          ref={setDroppableRef}
          className={cn(
            'space-y-3 p-4 transition-colors',
            isOver && 'bg-primary/10',
          )}
        >
          {chapters.length === 0 ? (
            <p
              className={cn(
                'rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground transition-colors',
                isOver && 'border-primary/50 bg-primary/5 text-foreground',
              )}
            >
              {isOver ? 'Drop chapter here' : 'No chapters in this module yet.'}
            </p>
          ) : (
            chapters.map((chapter, i) => (
              <BuilderChapter
                key={chapter.id}
                chapter={chapter}
                index={i}
                total={chapters.length}
                onRename={(title) => onRenameChapter(chapter.id, title)}
                onRemove={() => onRemoveChapter(chapter.id)}
                onMove={(dir) => onMoveChapter(chapter.id, dir)}
                onAddLesson={(type) => onAddLesson(chapter.id, type)}
                onRenameLesson={(lessonId, title) =>
                  onRenameLesson(chapter.id, lessonId, title)
                }
                onRemoveLesson={(lessonId) =>
                  onRemoveLesson(chapter.id, lessonId)
                }
                onMoveLesson={(from, to) =>
                  onMoveLesson(chapter.id, from, to)
                }
                onEditLesson={(lesson) =>
                  onEditLesson(chapter.id, lesson as LessonListItem)
                }
              />
            ))
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full border-dashed"
            onClick={onAddChapter}
          >
            <Plus />
            Add chapter to module
          </Button>
        </div>
      )}
    </Card>
  )
}
