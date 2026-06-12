'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  FolderOpen,
  GraduationCap,
  Layers,
  Loader2,
  Lock,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { MemberCourseDetail } from '@/lib/services/member-course-service'

type Module = MemberCourseDetail['modules'][number]
type Chapter = MemberCourseDetail['chapters'][number]
type Lesson = Chapter['lessons'][number]

interface CurriculumOutlineProps {
  modules: MemberCourseDetail['modules']
  looseChapters: MemberCourseDetail['looseChapters']
  courseId: string
  activeLessonId?: string
  variant?: 'page' | 'sidebar'
  /**
   * Lesson ids the user is allowed to open. If omitted, gating is
   * not enforced (used by surfaces that haven't migrated yet).
   * Status-locked lessons (PROCESSING / DRAFT) stay locked
   * regardless.
   */
  unlockedIds?: Set<string>
}

function lessonTypeIcon(
  type: 'VIDEO' | 'QUIZ' | 'RESOURCE',
  status: 'DRAFT' | 'PROCESSING' | 'READY',
): { Icon: LucideIcon; label: string } {
  if (status === 'PROCESSING') return { Icon: Loader2, label: 'Processing' }
  if (type === 'VIDEO') return { Icon: PlayCircle, label: 'Video' }
  if (type === 'QUIZ') return { Icon: GraduationCap, label: 'Quiz' }
  return { Icon: FileText, label: 'Resource' }
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function chapterProgress(chapter: Chapter): {
  completed: number
  total: number
  percent: number
} {
  const total = chapter.lessons.length
  const completed = chapter.lessons.filter(
    (l) => l.progress?.completed,
  ).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  return { completed, total, percent }
}

export function CurriculumOutline({
  modules,
  looseChapters,
  courseId,
  activeLessonId,
  variant = 'page',
  unlockedIds,
}: CurriculumOutlineProps) {
  if (variant === 'sidebar') {
    return (
      <SidebarOutline
        modules={modules}
        looseChapters={looseChapters}
        courseId={courseId}
        activeLessonId={activeLessonId}
        unlockedIds={unlockedIds}
      />
    )
  }
  return (
    <PageOutline
      modules={modules}
      looseChapters={looseChapters}
      courseId={courseId}
      unlockedIds={unlockedIds}
    />
  )
}

// ============================================
// PAGE — chapters render inside their parent module, both layers
// collapsible (default expanded). Numbering is continuous across
// modules + loose so the prefix stays consistent.
// ============================================

function moduleProgress(m: Module): { completed: number; total: number } {
  let completed = 0
  let total = 0
  for (const ch of m.chapters) {
    for (const l of ch.lessons) {
      total++
      if (l.progress?.completed) completed++
    }
  }
  return { completed, total }
}

function PageOutline({
  modules,
  looseChapters,
  courseId,
  unlockedIds,
}: {
  modules: Module[]
  looseChapters: Chapter[]
  courseId: string
  unlockedIds?: Set<string>
}) {
  // Collapsed-id sets — initialized empty so everything renders expanded
  // by default. Toggling flips membership.
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(
    () => new Set(),
  )
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(
    () => new Set(),
  )

  const toggleModule = useCallback((id: string) => {
    setCollapsedModules((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleChapter = useCallback((id: string) => {
    setCollapsedChapters((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Number chapters globally across modules + loose. The cursor is local
  // to this render — it resets every time React reconciles and produces
  // identical numbers on each render because module/loose order is the
  // same input.
  let chapterCursor = 0
  const renderChapter = (chapter: Chapter, nested: boolean) => {
    const index = chapterCursor++
    return (
      <ChapterCard
        key={chapter.id}
        chapter={chapter}
        index={index}
        courseId={courseId}
        unlockedIds={unlockedIds}
        collapsed={collapsedChapters.has(chapter.id)}
        onToggle={() => toggleChapter(chapter.id)}
        nested={nested}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {modules.map((m) => (
        <ModuleCard
          key={m.id}
          module={m}
          collapsed={collapsedModules.has(m.id)}
          onToggle={() => toggleModule(m.id)}
        >
          {m.chapters.map((c) => renderChapter(c, true))}
        </ModuleCard>
      ))}

      {looseChapters.length > 0 ? (
        <section className="flex flex-col gap-4">
          {modules.length > 0 ? (
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Additional chapters
            </h2>
          ) : null}
          <div className="flex flex-col gap-4">
            {looseChapters.map((c) => renderChapter(c, false))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function ModuleCard({
  module: m,
  collapsed,
  onToggle,
  children,
}: {
  module: Module
  collapsed: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const { completed, total } = moduleProgress(m)
  return (
    <Card className="gap-0 overflow-hidden border-primary/20 bg-primary/[0.03] p-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className={cn(
          'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-primary/[0.06]',
          !collapsed && 'border-b border-primary/15',
        )}
      >
        <ChevronDown
          className={cn(
            'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform',
            collapsed && '-rotate-90',
          )}
        />
        <Layers className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="truncate text-sm font-semibold tracking-tight">
            {m.title}
          </h2>
          {m.description ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {m.description}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {total > 0 ? `${completed} / ${total}` : 'no lessons'}
        </span>
      </button>
      {collapsed ? null : (
        <div className="space-y-3 bg-background p-4">
          {m.chapters.length === 0 ? (
            <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No chapters in this module yet.
            </p>
          ) : (
            children
          )}
        </div>
      )}
    </Card>
  )
}

function ChapterCard({
  chapter,
  index,
  courseId,
  unlockedIds,
  collapsed,
  onToggle,
  nested,
}: {
  chapter: Chapter
  index: number
  courseId: string
  unlockedIds?: Set<string>
  collapsed: boolean
  onToggle: () => void
  /** True when this chapter is rendered inside a ModuleCard — use a
   *  lighter card style so the visual hierarchy reads as nested. */
  nested: boolean
}) {
  const { completed, total, percent } = chapterProgress(chapter)
  const chapterDone = total > 0 && completed === total
  return (
    <Card
      className={cn(
        'gap-0 overflow-hidden p-0',
        nested && 'border-border/60 shadow-none',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className={cn(
          'flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40',
          !collapsed && 'border-b bg-muted/30',
        )}
      >
        <ChevronDown
          className={cn(
            'mt-1 size-4 shrink-0 text-muted-foreground transition-transform',
            collapsed && '-rotate-90',
          )}
        />
        <span
          className={cn(
            'inline-flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold tabular-nums',
            chapterDone
              ? 'bg-success/15 text-success'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="truncate text-sm font-semibold">{chapter.title}</h3>
          {total > 0 ? <Progress value={percent} className="h-1" /> : null}
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {completed} / {total} {total === 1 ? 'lesson' : 'lessons'}
        </span>
      </button>
      {collapsed ? null : total === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">
          No lessons yet.
        </p>
      ) : (
        <ul className="divide-y">
          {chapter.lessons.map((lesson) => (
            <PageLessonRow
              key={lesson.id}
              lesson={lesson}
              courseId={courseId}
              gated={
                unlockedIds !== undefined && !unlockedIds.has(lesson.id)
              }
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

function PageLessonRow({
  lesson,
  courseId,
  gated,
}: {
  lesson: Lesson
  courseId: string
  gated: boolean
}) {
  const { Icon, label } = lessonTypeIcon(lesson.type, lesson.status)
  const completed = lesson.progress?.completed ?? false
  const statusLocked = lesson.status !== 'READY'
  const locked = statusLocked || gated
  const duration = formatDuration(lesson.durationSeconds)

  const body = (
    <>
      {completed ? (
        <CheckCircle2 className="size-4 shrink-0 text-success" />
      ) : locked ? (
        <Lock className="size-4 shrink-0 text-muted-foreground/60" />
      ) : (
        <Circle className="size-4 shrink-0 text-muted-foreground/50" />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm',
            locked && !completed && 'text-muted-foreground',
          )}
        >
          {lesson.title}
        </p>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <Icon
            className={cn(
              'size-3',
              lesson.status === 'PROCESSING' && 'animate-spin',
            )}
          />
          {label}
          {duration ? ` · ${duration}` : ''}
          {statusLocked && lesson.status === 'PROCESSING'
            ? ' · still processing'
            : null}
          {gated && !statusLocked
            ? ' · complete previous lesson first'
            : null}
        </p>
      </div>
    </>
  )

  if (locked) {
    return (
      <li
        className="flex cursor-not-allowed items-center gap-3 px-5 py-3 text-sm opacity-70"
        aria-disabled
      >
        {body}
      </li>
    )
  }

  return (
    <li>
      <Link
        href={`/courses/${courseId}/lessons/${lesson.id}`}
        className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-muted/60"
      >
        {body}
      </Link>
    </li>
  )
}

// ============================================
// SIDEBAR — compact list used inside the player Card
// ============================================

function SidebarOutline({
  modules,
  looseChapters,
  courseId,
  activeLessonId,
  unlockedIds,
}: {
  modules: Module[]
  looseChapters: Chapter[]
  courseId: string
  activeLessonId?: string
  unlockedIds?: Set<string>
}) {
  let chapterCursor = 0
  const renderChapter = (chapter: Chapter) => {
    const index = chapterCursor++
    return (
      <SidebarChapter
        key={chapter.id}
        chapter={chapter}
        index={index}
        courseId={courseId}
        activeLessonId={activeLessonId}
        unlockedIds={unlockedIds}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {modules.map((m) => (
        <div key={m.id} className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <FolderOpen className="size-3.5 text-primary" />
            <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.12em] text-foreground/80">
              {m.title}
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            {m.chapters.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                No chapters yet.
              </p>
            ) : (
              m.chapters.map(renderChapter)
            )}
          </div>
        </div>
      ))}

      {looseChapters.length > 0 ? (
        <div className="space-y-3">
          {modules.length > 0 ? (
            <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Additional chapters
            </h2>
          ) : null}
          <div className="flex flex-col gap-4">
            {looseChapters.map(renderChapter)}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SidebarChapter({
  chapter,
  index,
  courseId,
  activeLessonId,
  unlockedIds,
}: {
  chapter: Chapter
  index: number
  courseId: string
  activeLessonId?: string
  unlockedIds?: Set<string>
}) {
  const { completed, total, percent } = chapterProgress(chapter)
  return (
    <div>
      <div className="mb-2 space-y-1 px-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-medium">
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {String(index + 1).padStart(2, '0')}
            </span>{' '}
            {chapter.title}
          </h3>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {completed} / {total}
          </span>
        </div>
        {total > 0 ? <Progress value={percent} className="h-1" /> : null}
      </div>
      {total === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">
          No lessons yet.
        </p>
      ) : (
        <ul className="flex flex-col">
          {chapter.lessons.map((lesson) => (
            <SidebarLessonRow
              key={lesson.id}
              lesson={lesson}
              courseId={courseId}
              active={lesson.id === activeLessonId}
              gated={
                unlockedIds !== undefined && !unlockedIds.has(lesson.id)
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function SidebarLessonRow({
  lesson,
  courseId,
  active,
  gated,
}: {
  lesson: Lesson
  courseId: string
  active: boolean
  gated: boolean
}) {
  const { Icon, label } = lessonTypeIcon(lesson.type, lesson.status)
  const completed = lesson.progress?.completed ?? false
  const statusLocked = lesson.status !== 'READY'
  const locked = statusLocked || gated
  const duration = formatDuration(lesson.durationSeconds)

  const body = (
    <>
      {completed ? (
        <CheckCircle2 className="size-4 shrink-0 text-success" />
      ) : locked ? (
        <Lock className="size-4 shrink-0 text-muted-foreground/60" />
      ) : (
        <Circle className="size-4 shrink-0 text-muted-foreground/50" />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm',
            active && 'font-medium text-primary',
            locked && !completed && 'text-muted-foreground',
          )}
        >
          {lesson.title}
        </p>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <Icon
            className={cn(
              'size-3',
              lesson.status === 'PROCESSING' && 'animate-spin',
            )}
          />
          {label}
          {duration ? ` · ${duration}` : ''}
          {statusLocked && lesson.status === 'PROCESSING'
            ? ' · still processing'
            : null}
          {gated && !statusLocked
            ? ' · complete previous lesson first'
            : null}
        </p>
      </div>
    </>
  )

  const baseClass = cn(
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
  )

  if (locked) {
    return (
      <li
        className={cn(baseClass, 'cursor-not-allowed opacity-70')}
        aria-disabled
      >
        {body}
      </li>
    )
  }

  return (
    <li>
      <Link
        href={`/courses/${courseId}/lessons/${lesson.id}`}
        scroll={false}
        aria-current={active ? 'page' : undefined}
        className={cn(
          baseClass,
          active ? 'bg-primary/10' : 'hover:bg-muted/60',
        )}
      >
        {body}
      </Link>
    </li>
  )
}
