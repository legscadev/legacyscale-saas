'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ExternalLink,
  Layers,
  Plus,
  Save,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { LessonType } from '@prisma/client'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EmptyState, StatusBadge } from '@/components/shared'
import {
  getLessonStatusAction,
  saveCourseStructureAction,
} from '@/app/(admin)/admin/courses/[id]/actions'
import type { CourseDetail } from '@/lib/services/course-service'
import type {
  ChapterListItem,
  LessonListItem,
} from '@/lib/services/chapter-service'
import { BuilderChapter } from './builder-chapter'
import { LessonEditorDialog } from './lesson-editor-dialog'

// Local row types extend the server-shaped items with an optional
// tempId so new rows can be added client-side before the next Save
// round-trip. After save, tempId is cleared and id holds the real
// DB uuid.
type LocalLesson = LessonListItem & { tempId?: string }
type LocalChapter = Omit<ChapterListItem, 'lessons'> & {
  tempId?: string
  lessons: LocalLesson[]
}

const LESSON_DEFAULT_TITLE: Record<LessonType, string> = {
  VIDEO: 'New video lesson',
  QUIZ: 'New quiz lesson',
  RESOURCE: 'New resource lesson',
}

interface CourseBuilderProps {
  course: CourseDetail
  chapters: ChapterListItem[]
}

export function CourseBuilder({
  course,
  chapters: initialChapters,
}: CourseBuilderProps) {
  const router = useRouter()

  const [chapters, setChapters] = useState<LocalChapter[]>(initialChapters)
  const [saving, setSaving] = useState(false)
  // Tracks the snapshot we last successfully synced to the server.
  // Used both for the Discard button and for the isDirty check.
  const [savedSnapshot, setSavedSnapshot] = useState<LocalChapter[]>(
    initialChapters,
  )
  const [pendingNav, setPendingNav] = useState<string | null>(null)
  // { chapterId, lessonId } — null when no editor open. Stored as
  // identifiers (not the lesson object itself) so the dialog always
  // reads the freshest copy out of state.
  const [editingRef, setEditingRef] = useState<
    { chapterId: string; lessonId: string } | null
  >(null)

  // dnd-kit sensors — pointer for mouse/touch, keyboard for a11y.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const lessonCount = chapters.reduce((n, c) => n + c.lessons.length, 0)

  // isDirty by JSON comparison of the normalized shape — captures
  // adds, deletes, renames, type changes, and reorders without needing
  // a per-op counter.
  const isDirty = useMemo(
    () => serialize(chapters) !== serialize(savedSnapshot),
    [chapters, savedSnapshot],
  )

  // Browser-level navigation guard. Soft client-side nav goes through
  // pendingNav + AlertDialog (see link click handlers below).
  useEffect(() => {
    if (!isDirty) return
    function beforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [isDirty])

  // Stable key for the SET of currently-PROCESSING lesson ids — the
  // polling effect should restart only when that set actually changes
  // (added a new one after upload, or one transitioned away), not on
  // every re-render.
  const processingIdsKey = chapters
    .flatMap((c) => c.lessons)
    .filter((l) => l.status === 'PROCESSING')
    .map((l) => l.id)
    .sort()
    .join(',')

  // Poll PROCESSING lessons every 10s until they flip to READY (or
  // back to DRAFT on Mux error). Updates lesson status, duration, and
  // playbackId in-place so badges + the editor dialog auto-update.
  useEffect(() => {
    if (!processingIdsKey) return
    const ids = processingIdsKey.split(',')
    let cancelled = false

    async function tick() {
      const results = await Promise.all(ids.map((id) => getLessonStatusAction(id)))
      if (cancelled) return
      for (const result of results) {
        if (!result.ok || !result.lesson) continue
        const incoming = result.lesson
        if (incoming.status === 'PROCESSING') continue
        // Mutate in place — these webhook-driven fields aren't part of
        // the isDirty snapshot so this doesn't flip the Save button.
        setChapters((prev) =>
          prev.map((c) =>
            c.id === incoming.chapterId
              ? {
                  ...c,
                  lessons: c.lessons.map((l) =>
                    l.id === incoming.id
                      ? {
                          ...l,
                          status: incoming.status,
                          durationSeconds: incoming.durationSeconds,
                          muxPlaybackId: incoming.muxPlaybackId,
                        }
                      : l,
                  ),
                }
              : c,
          ),
        )
        // Also sync the saved snapshot so a later isDirty check stays
        // accurate after edits to other fields.
        setSavedSnapshot((prev) =>
          prev.map((c) =>
            c.id === incoming.chapterId
              ? {
                  ...c,
                  lessons: c.lessons.map((l) =>
                    l.id === incoming.id
                      ? {
                          ...l,
                          status: incoming.status,
                          durationSeconds: incoming.durationSeconds,
                          muxPlaybackId: incoming.muxPlaybackId,
                        }
                      : l,
                  ),
                }
              : c,
          ),
        )
      }
    }

    // Kick once immediately so a freshly-uploaded video doesn't wait
    // a full 10s before the first check.
    void tick()
    const interval = setInterval(tick, 10_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [processingIdsKey])

  // ===========================================================
  // Local mutations — no network calls, all changes batch until Save.
  // ===========================================================

  const patchChapter = useCallback(
    (chapterId: string, fn: (chapter: LocalChapter) => LocalChapter) => {
      setChapters((prev) =>
        prev.map((c) => (c.id === chapterId ? fn(c) : c)),
      )
    },
    [],
  )

  const addChapter = useCallback(() => {
    const tempId = `temp-ch-${crypto.randomUUID()}`
    const now = new Date()
    setChapters((prev) => [
      ...prev,
      {
        id: tempId,
        tempId,
        courseId: course.id,
        title: 'New chapter',
        orderIndex: prev.length,
        createdAt: now,
        updatedAt: now,
        lessons: [],
      },
    ])
  }, [course.id])

  const renameChapter = useCallback(
    (id: string, nextTitle: string) => {
      patchChapter(id, (c) => ({ ...c, title: nextTitle }))
    },
    [patchChapter],
  )

  const removeChapter = useCallback((id: string) => {
    setChapters((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const moveChapter = useCallback((id: string, dir: -1 | 1) => {
    setChapters((prev) => {
      const index = prev.findIndex((c) => c.id === id)
      if (index === -1) return prev
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved!)
      return next
    })
  }, [])

  const moveChapterTo = useCallback((id: string, to: number) => {
    setChapters((prev) => {
      const from = prev.findIndex((c) => c.id === id)
      if (from === -1 || from === to) return prev
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved!)
      return next
    })
  }, [])

  const addLesson = useCallback(
    (chapterId: string, type: LessonType) => {
      const tempId = `temp-l-${crypto.randomUUID()}`
      patchChapter(chapterId, (c) => ({
        ...c,
        lessons: [
          ...c.lessons,
          {
            id: tempId,
            tempId,
            chapterId,
            title: LESSON_DEFAULT_TITLE[type],
            description: null,
            type,
            status: 'DRAFT',
            orderIndex: c.lessons.length,
            durationSeconds: null,
            muxPlaybackId: null,
            resourceUrl: null,
            resourceName: null,
            resourceSize: null,
          },
        ],
      }))
    },
    [patchChapter],
  )

  const renameLesson = useCallback(
    (chapterId: string, lessonId: string, nextTitle: string) => {
      patchChapter(chapterId, (c) => ({
        ...c,
        lessons: c.lessons.map((l) =>
          l.id === lessonId ? { ...l, title: nextTitle } : l,
        ),
      }))
    },
    [patchChapter],
  )

  const patchLesson = useCallback(
    (
      chapterId: string,
      lessonId: string,
      changes: Partial<Pick<LocalLesson, 'title' | 'description'>>,
    ) => {
      patchChapter(chapterId, (c) => ({
        ...c,
        lessons: c.lessons.map((l) =>
          l.id === lessonId ? { ...l, ...changes } : l,
        ),
      }))
    },
    [patchChapter],
  )

  const openLessonEditor = useCallback(
    (chapterId: string, lesson: LocalLesson) => {
      // VIDEO (2.10/2.10b) and RESOURCE (2.13) editors are wired.
      // QUIZ editor lands in a later ticket.
      if (lesson.type === 'QUIZ') {
        toast.info('Quiz lesson editor lands in a later ticket.')
        return
      }
      setEditingRef({ chapterId, lessonId: lesson.id })
    },
    [],
  )

  // Resolve the editing lesson freshly from chapters so the dialog
  // always sees the latest title/description (e.g. as the user types).
  const editingLesson = editingRef
    ? (chapters
        .find((c) => c.id === editingRef.chapterId)
        ?.lessons.find((l) => l.id === editingRef.lessonId) ?? null)
    : null

  const removeLesson = useCallback(
    (chapterId: string, lessonId: string) => {
      patchChapter(chapterId, (c) => ({
        ...c,
        lessons: c.lessons.filter((l) => l.id !== lessonId),
      }))
    },
    [patchChapter],
  )

  const moveLesson = useCallback(
    (chapterId: string, from: number, to: number) => {
      if (from === to) return
      patchChapter(chapterId, (c) => {
        if (to < 0 || to >= c.lessons.length) return c
        const next = [...c.lessons]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved!)
        return { ...c, lessons: next }
      })
    },
    [patchChapter],
  )

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const activeType = active.data.current?.type
      const overType = over.data.current?.type

      if (activeType === 'chapter' && overType === 'chapter') {
        const to = chapters.findIndex((c) => c.id === over.id)
        if (to === -1) return
        moveChapterTo(String(active.id), to)
        return
      }

      if (activeType === 'lesson' && overType === 'lesson') {
        const fromChapter = active.data.current?.chapterId as
          | string
          | undefined
        const toChapter = over.data.current?.chapterId as string | undefined
        if (!fromChapter || fromChapter !== toChapter) return
        const chapter = chapters.find((c) => c.id === fromChapter)
        if (!chapter) return
        const from = chapter.lessons.findIndex((l) => l.id === active.id)
        const to = chapter.lessons.findIndex((l) => l.id === over.id)
        if (from === -1 || to === -1) return
        moveLesson(fromChapter, from, to)
      }
    },
    [chapters, moveChapterTo, moveLesson],
  )

  // ===========================================================
  // Save / Discard
  // ===========================================================

  const onSave = useCallback(async () => {
    setSaving(true)
    try {
      const payload = toSyncPayload(chapters)
      const result = await saveCourseStructureAction(course.id, payload)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not save changes')
        return
      }
      const next = applyMappings(chapters, result.mappings)
      setChapters(next)
      setSavedSnapshot(next)
      toast.success('Changes saved')
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }, [chapters, course.id, router])

  const onDiscard = useCallback(() => {
    setChapters(savedSnapshot)
  }, [savedSnapshot])

  // ===========================================================
  // Navigation guard for internal links
  // ===========================================================
  //
  // pendingNav doubles as the dialog open state and the target href —
  // when non-null, the dialog renders and the buttons know where to
  // navigate on confirm.

  const guardNav = useCallback(
    (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!isDirty) return
      e.preventDefault()
      setPendingNav(href)
    },
    [isDirty],
  )

  const proceedAfterDiscard = useCallback(() => {
    const href = pendingNav
    setPendingNav(null)
    if (href) router.push(href)
  }, [pendingNav, router])

  const saveAndProceed = useCallback(async () => {
    const href = pendingNav
    await onSave()
    setPendingNav(null)
    if (href) router.push(href)
  }, [onSave, pendingNav, router])

  // ===========================================================
  // Render
  // ===========================================================

  return (
    <div className="space-y-6">
      <Link
        href="/admin/courses"
        onClick={guardNav('/admin/courses')}
        className="inline-flex items-center gap-1.5 -ml-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All courses
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {course.title}
          </h1>
          <StatusBadge status={course.status} />
        </div>
        <div className="flex items-center gap-2">
          {isDirty ? (
            <span className="text-xs text-warning">Unsaved changes</span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            disabled={!isDirty || saving}
            onClick={onDiscard}
          >
            <Undo2 />
            Discard
          </Button>
          <Button
            size="sm"
            disabled={!isDirty || saving}
            onClick={onSave}
          >
            <Save />
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {chapters.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Start building your course"
              description="Add a chapter, then fill it with video, quiz, and resource lessons."
            >
              <Button onClick={addChapter}>
                <Plus />
                Add chapter
              </Button>
            </EmptyState>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={chapters.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {chapters.map((ch, i) => (
                  <BuilderChapter
                    key={ch.id}
                    chapter={ch}
                    index={i}
                    total={chapters.length}
                    onRename={(t) => renameChapter(ch.id, t)}
                    onRemove={() => removeChapter(ch.id)}
                    onMove={(dir) => moveChapter(ch.id, dir)}
                    onAddLesson={(type) => addLesson(ch.id, type)}
                    onRenameLesson={(lessonId, title) =>
                      renameLesson(ch.id, lessonId, title)
                    }
                    onRemoveLesson={(lessonId) =>
                      removeLesson(ch.id, lessonId)
                    }
                    onMoveLesson={(from, to) => moveLesson(ch.id, from, to)}
                    onEditLesson={(lesson) =>
                      openLessonEditor(ch.id, lesson as LocalLesson)
                    }
                  />
                ))}
              </SortableContext>
            </DndContext>
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

            <DetailRow label="Title">{course.title}</DetailRow>
            <DetailRow label="Description">
              {course.description ?? (
                <span className="text-muted-foreground/70 italic">
                  No description yet.
                </span>
              )}
            </DetailRow>
            <DetailRow label="Status">
              <StatusBadge status={course.status} />
            </DetailRow>

            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span>
                {chapters.length}{' '}
                {chapters.length === 1 ? 'chapter' : 'chapters'}
              </span>
              <span>
                {lessonCount} {lessonCount === 1 ? 'lesson' : 'lessons'}
              </span>
            </div>

            <Link
              href={`/admin/courses/${course.id}/edit`}
              onClick={guardNav(`/admin/courses/${course.id}/edit`)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              <ExternalLink className="size-3" />
              Edit title, description, status, thumbnail
            </Link>
          </Card>
        </aside>
      </div>

      <LessonEditorDialog
        open={editingRef !== null && editingLesson !== null}
        onOpenChange={(open) => {
          if (!open) setEditingRef(null)
        }}
        lesson={editingLesson}
        courseId={course.id}
        isUnsaved={Boolean(editingLesson && (editingLesson as LocalLesson).tempId)}
        onChange={(changes) => {
          if (!editingRef) return
          patchLesson(editingRef.chapterId, editingRef.lessonId, changes)
        }}
        onResourceUploaded={(changes) => {
          if (!editingRef) return
          patchChapter(editingRef.chapterId, (c) => ({
            ...c,
            lessons: c.lessons.map((l) =>
              l.id === editingRef.lessonId ? { ...l, ...changes } : l,
            ),
          }))
          // Resource commit also lands on the server (status flips to
          // READY, resourceUrl is set), so update the saved snapshot in
          // place — these fields aren't part of isDirty tracking, but
          // we want re-opens of the dialog to see the new state without
          // a manual save.
          setSavedSnapshot((prev) =>
            prev.map((c) =>
              c.id === editingRef.chapterId
                ? {
                    ...c,
                    lessons: c.lessons.map((l) =>
                      l.id === editingRef.lessonId ? { ...l, ...changes } : l,
                    ),
                  }
                : c,
            ),
          )
        }}
        onVideoUploadStarted={() => {
          if (!editingRef) return
          // Optimistic flip: Mux's upchunk finished, the webhook will
          // (within seconds) mark the lesson PROCESSING server-side
          // and then READY. Updating local state to PROCESSING now
          // lights up the badge and arms the polling effect.
          const patch = { status: 'PROCESSING' as const }
          patchChapter(editingRef.chapterId, (c) => ({
            ...c,
            lessons: c.lessons.map((l) =>
              l.id === editingRef.lessonId ? { ...l, ...patch } : l,
            ),
          }))
          setSavedSnapshot((prev) =>
            prev.map((c) =>
              c.id === editingRef.chapterId
                ? {
                    ...c,
                    lessons: c.lessons.map((l) =>
                      l.id === editingRef.lessonId ? { ...l, ...patch } : l,
                    ),
                  }
                : c,
            ),
          )
        }}
      />

      <AlertDialog
        open={pendingNav !== null}
        onOpenChange={(open) => {
          if (!open) setPendingNav(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits to chapters or lessons. Save before
              leaving, or discard them and continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay on page</AlertDialogCancel>
            <Button
              variant="ghost"
              onClick={(e) => {
                e.preventDefault()
                proceedAfterDiscard()
              }}
              disabled={saving}
            >
              Discard and leave
            </Button>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void saveAndProceed()
              }}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save and leave'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

// ===========================================================
// Serialization helpers
// ===========================================================

function serialize(chapters: LocalChapter[]): string {
  return JSON.stringify(
    chapters.map((c, ci) => ({
      id: c.tempId ? null : c.id,
      tempId: c.tempId ?? null,
      title: c.title,
      orderIndex: ci,
      lessons: c.lessons.map((l, li) => ({
        id: l.tempId ? null : l.id,
        tempId: l.tempId ?? null,
        title: l.title,
        description: l.description ?? null,
        type: l.type,
        orderIndex: li,
      })),
    })),
  )
}

function toSyncPayload(chapters: LocalChapter[]) {
  return {
    chapters: chapters.map((c, ci) => ({
      id: c.tempId ? undefined : c.id,
      tempId: c.tempId,
      title: c.title.trim() || 'Untitled chapter',
      orderIndex: ci,
      lessons: c.lessons.map((l, li) => ({
        id: l.tempId ? undefined : l.id,
        tempId: l.tempId,
        title: l.title.trim() || 'Untitled lesson',
        type: l.type,
        orderIndex: li,
      })),
    })),
  }
}

function applyMappings(
  chapters: LocalChapter[],
  mappings:
    | {
        chapterMappings: Array<{ tempId: string; realId: string }>
        lessonMappings: Array<{ tempId: string; realId: string }>
      }
    | undefined,
): LocalChapter[] {
  if (!mappings) return chapters
  const chapterMap = new Map(
    mappings.chapterMappings.map((m) => [m.tempId, m.realId]),
  )
  const lessonMap = new Map(
    mappings.lessonMappings.map((m) => [m.tempId, m.realId]),
  )
  return chapters.map((c) => {
    const realChapterId = c.tempId
      ? (chapterMap.get(c.tempId) ?? c.id)
      : c.id
    return {
      ...c,
      id: realChapterId,
      tempId: undefined,
      lessons: c.lessons.map((l) => {
        const realLessonId = l.tempId
          ? (lessonMap.get(l.tempId) ?? l.id)
          : l.id
        return {
          ...l,
          id: realLessonId,
          chapterId: realChapterId,
          tempId: undefined,
        }
      }),
    }
  })
}
