'use client'

import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ExternalLink,
  FolderPlus,
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
  createModuleAction,
  deleteModuleAction,
  getLessonStatusAction,
  saveCourseStructureAction,
  updateModuleAction,
  type SaveStructureResult,
} from '@/app/(admin)/admin/courses/[id]/actions'
import type { CourseDetail } from '@/lib/services/course-service'
import type {
  ChapterListItem,
  LessonListItem,
} from '@/lib/services/chapter-service'
import type { ModuleListItem } from '@/lib/services/module-service'
import { BuilderChapter } from './builder-chapter'
import { BuilderModule } from './builder-module'
import { LessonEditorDialog } from './lesson-editor-dialog'
import { ModuleDialog, type ModuleDialogValues } from './module-dialog'

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
  modules: ModuleListItem[]
  chapters: ChapterListItem[]
}

// State model:
// - `modules` carries the course's module list in display order.
//   Modules persist immediately via server actions (no batching), so
//   we don't track a saved snapshot for them — module state is always
//   in sync with the server.
// - `chapters` is a flat list. Each chapter carries `moduleId` (null
//   for loose chapters that sit directly on the course). Chapters
//   batch until Save; orderIndex is scoped per parent (module or
//   loose group) on serialization.
export function CourseBuilder({
  course,
  modules: initialModules,
  chapters: initialChapters,
}: CourseBuilderProps) {
  const router = useRouter()

  const [modules, setModules] = useState<ModuleListItem[]>(initialModules)
  const [chapters, setChapters] = useState<LocalChapter[]>(initialChapters)
  const [saving, setSaving] = useState(false)
  // Tracks the snapshot we last successfully synced to the server.
  // Used both for the Discard button and for the isDirty check.
  const [savedSnapshot, setSavedSnapshot] = useState<LocalChapter[]>(
    initialChapters,
  )

  // Module dialog state. `editingModuleId === null && createOpen`
  // means create; a UUID means edit.
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false)
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  // Confirm delete on a module — chapters under it become loose.
  const [pendingDeleteModuleId, setPendingDeleteModuleId] = useState<
    string | null
  >(null)
  // Which modules are collapsed in the UI. Default: all expanded.
  const [collapsedModuleIds, setCollapsedModuleIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [pendingNav, setPendingNav] = useState<string | null>(null)
  // { chapterId, lessonId } — null when no editor open. Stored as
  // identifiers (not the lesson object itself) so the dialog always
  // reads the freshest copy out of state.
  const [editingRef, setEditingRef] = useState<
    { chapterId: string; lessonId: string } | null
  >(null)

  // Lesson ids whose Mux upload just finished — we keep polling these
  // even if the dialog is closed and even if the optimistic PROCESSING
  // patch never landed on the chapters state, so the badge eventually
  // flips to Ready without a manual refresh.
  const [pendingUploadIds, setPendingUploadIds] = useState<string[]>([])

  // dnd-kit sensors — pointer for mouse/touch, keyboard for a11y.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  // Stable id for DndContext so the auto-generated aria-describedby
  // IDs match between server and client renders. Without this,
  // dnd-kit's internal counter starts fresh on each side and React
  // logs a hydration mismatch warning on every page load.
  const dndContextId = useId()

  const lessonCount = chapters.reduce((n, c) => n + c.lessons.length, 0)
  const looseChapters = useMemo(
    () => chapters.filter((c) => c.moduleId === null),
    [chapters],
  )

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

  // Stable key for the SET of lesson ids that should be polled — both
  // those currently PROCESSING server-side AND those we just kicked
  // off an upload for (which may not have flipped to PROCESSING in
  // local state yet if the optimistic patch missed). The effect
  // restarts only when this set actually changes, not on every re-render.
  const processingIdsKey = Array.from(
    new Set([
      ...chapters
        .flatMap((c) => c.lessons)
        .filter((l) => l.status === 'PROCESSING')
        .map((l) => l.id),
      ...pendingUploadIds,
    ]),
  )
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
      for (let i = 0; i < results.length; i++) {
        const result = results[i]!
        const pollId = ids[i]!
        if (!result.ok || !result.lesson) {
          // Lesson is gone (deleted while polling) — stop watching.
          setPendingUploadIds((prev) => prev.filter((id) => id !== pollId))
          continue
        }
        const incoming = result.lesson
        if (incoming.status === 'PROCESSING') continue
        // Lesson reached a terminal state for this upload — drop it
        // from the post-upload tracker so polling stops once nothing
        // else needs watching.
        setPendingUploadIds((prev) => prev.filter((id) => id !== incoming.id))
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

  // moduleId === null adds a loose chapter; a UUID nests it under
  // that module. New chapters always slot at the end of their scope.
  const addChapter = useCallback(
    (moduleId: string | null) => {
      const tempId = `temp-ch-${crypto.randomUUID()}`
      const now = new Date()
      setChapters((prev) => {
        const siblings = prev.filter((c) => c.moduleId === moduleId)
        return [
          ...prev,
          {
            id: tempId,
            tempId,
            courseId: course.id,
            moduleId,
            title: 'New chapter',
            orderIndex: siblings.length,
            createdAt: now,
            updatedAt: now,
            lessons: [],
          },
        ]
      })
    },
    [course.id],
  )

  const renameChapter = useCallback(
    (id: string, nextTitle: string) => {
      patchChapter(id, (c) => ({ ...c, title: nextTitle }))
    },
    [patchChapter],
  )

  const removeChapter = useCallback((id: string) => {
    setChapters((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // ===========================================================
  // Module ops — persist immediately (no batching).
  // ===========================================================

  const openCreateModule = useCallback(() => {
    setEditingModuleId(null)
    setModuleDialogOpen(true)
  }, [])

  const openEditModule = useCallback((moduleId: string) => {
    setEditingModuleId(moduleId)
    setModuleDialogOpen(true)
  }, [])

  const editingModule = editingModuleId
    ? (modules.find((m) => m.id === editingModuleId) ?? null)
    : null

  const onModuleSubmit = useCallback(
    async (values: ModuleDialogValues): Promise<{ ok: boolean }> => {
      if (editingModuleId === null) {
        const result = await createModuleAction(course.id, {
          title: values.title,
          description: values.description ?? undefined,
        })
        if (!result.ok || !result.module) {
          toast.error(result.error ?? 'Could not create module')
          return { ok: false }
        }
        setModules((prev) => [...prev, result.module!])
        toast.success('Module created')
        return { ok: true }
      }

      const result = await updateModuleAction(editingModuleId, values)
      if (!result.ok || !result.module) {
        toast.error(result.error ?? 'Could not update module')
        return { ok: false }
      }
      setModules((prev) =>
        prev.map((m) => (m.id === editingModuleId ? result.module! : m)),
      )
      toast.success('Module updated')
      return { ok: true }
    },
    [course.id, editingModuleId],
  )

  const onModuleDeleteConfirm = useCallback(async () => {
    if (!pendingDeleteModuleId) return
    const moduleId = pendingDeleteModuleId
    setPendingDeleteModuleId(null)

    const result = await deleteModuleAction(moduleId)
    if (!result.ok) {
      toast.error(result.error ?? 'Could not delete module')
      return
    }
    setModules((prev) => prev.filter((m) => m.id !== moduleId))
    // Chapters that were under this module become loose locally —
    // the server already did the SetNull via FK cascade. Update local
    // state AND the saved snapshot so isDirty stays accurate.
    const detach = (cs: LocalChapter[]) =>
      cs.map((c) => (c.moduleId === moduleId ? { ...c, moduleId: null } : c))
    setChapters(detach)
    setSavedSnapshot(detach)
    toast.success('Module deleted')
  }, [pendingDeleteModuleId])

  const toggleModuleCollapsed = useCallback((moduleId: string) => {
    setCollapsedModuleIds((prev) => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }, [])

  // Up/down arrows reorder within the chapter's own scope (module or
  // loose group). Crossing scopes is intentionally not supported by
  // the arrows — that's a "move chapter to module" UX we're not
  // building in v1.
  const moveChapter = useCallback((id: string, dir: -1 | 1) => {
    setChapters((prev) => {
      const target = prev.find((c) => c.id === id)
      if (!target) return prev
      const sameScope = prev.filter((c) => c.moduleId === target.moduleId)
      const scopeIndex = sameScope.findIndex((c) => c.id === id)
      const swapWith = sameScope[scopeIndex + dir]
      if (!swapWith) return prev

      // Re-emit the array with the two ids swapped in their absolute
      // positions. Other items stay where they are.
      const fromAbs = prev.indexOf(target)
      const toAbs = prev.indexOf(swapWith)
      const next = [...prev]
      next[fromAbs] = swapWith
      next[toAbs] = target
      return next
    })
  }, [])

  // dnd-kit reorder within the same scope only. Returns void early
  // when the two chapters live in different parents.
  const moveChapterTo = useCallback((activeId: string, overId: string) => {
    setChapters((prev) => {
      const active = prev.find((c) => c.id === activeId)
      const over = prev.find((c) => c.id === overId)
      if (!active || !over) return prev
      if (active.moduleId !== over.moduleId) return prev

      const sameScope = prev.filter((c) => c.moduleId === active.moduleId)
      const from = sameScope.findIndex((c) => c.id === activeId)
      const to = sameScope.findIndex((c) => c.id === overId)
      if (from === -1 || to === -1 || from === to) return prev

      const reordered = [...sameScope]
      const [moved] = reordered.splice(from, 1)
      reordered.splice(to, 0, moved!)

      // Splice the reordered scope back into the absolute order:
      // walk prev, substitute scope-matching slots with reordered.
      let scopeCursor = 0
      return prev.map((c) =>
        c.moduleId === active.moduleId ? reordered[scopeCursor++]! : c,
      )
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
            resources: [],
          },
        ],
      }))
      setEditingRef({ chapterId, lessonId: tempId })
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
        // moveChapterTo no-ops when active/over live in different
        // scopes (modules vs loose), so it's safe to call blindly.
        moveChapterTo(String(active.id), String(over.id))
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

  // Returns the server mappings so callers that need the new real
  // id for a previously-temp row can resolve it. `silent` suppresses
  // the success toast for invisible saves (e.g. auto-save before an
  // upload).
  const performSave = useCallback(
    async (
      opts: { silent?: boolean } = {},
    ): Promise<
      | { ok: true; mappings: SaveStructureResult['mappings'] }
      | { ok: false; error?: string }
    > => {
      setSaving(true)
      try {
        const payload = toSyncPayload(chapters)
        const result = await saveCourseStructureAction(course.id, payload)
        if (!result.ok) {
          if (!opts.silent) {
            toast.error(result.error ?? 'Could not save changes')
          }
          return { ok: false, error: result.error }
        }
        const next = applyMappings(chapters, result.mappings)
        setChapters(next)
        setSavedSnapshot(next)
        if (!opts.silent) toast.success('Changes saved')
        router.refresh()
        return { ok: true, mappings: result.mappings }
      } catch (err) {
        console.error(err)
        if (!opts.silent) toast.error('Network error — please try again')
        return { ok: false }
      } finally {
        setSaving(false)
      }
    },
    [chapters, course.id, router],
  )

  const onSave = useCallback(() => {
    void performSave()
  }, [performSave])

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

  // Auto-save trigger for upload flows. The Mux + Storage prepare
  // actions both need a real lesson uuid as their passthrough /
  // path leaf; a temp client-side id breaks the webhook → lesson
  // mapping. When the user clicks Upload on an unsaved lesson, we
  // silently flush the whole structure, look up the new real id
  // for the currently-editing lesson, and hand it back so the
  // upload can proceed using it.
  const ensureLessonSaved = useCallback(async (): Promise<
    { ok: true; lessonId: string } | { ok: false; error?: string }
  > => {
    if (!editingRef) return { ok: false, error: 'No lesson selected' }
    const lesson = chapters
      .find((c) => c.id === editingRef.chapterId)
      ?.lessons.find((l) => l.id === editingRef.lessonId)
    if (!lesson) return { ok: false, error: 'Lesson not found' }

    // Already saved — return current id, no round-trip.
    if (!lesson.tempId) return { ok: true, lessonId: lesson.id }

    const result = await performSave({ silent: true })
    if (!result.ok) {
      return { ok: false, error: result.error ?? 'Could not save lesson' }
    }
    const mapping = result.mappings?.lessonMappings.find(
      (m) => m.tempId === lesson.tempId,
    )
    if (!mapping) {
      return { ok: false, error: 'Lesson id was not mapped after save' }
    }
    // Re-point the editing ref at the new real id so subsequent
    // re-opens of the dialog find the row.
    setEditingRef({
      chapterId: editingRef.chapterId,
      lessonId: mapping.realId,
    })
    return { ok: true, lessonId: mapping.realId }
  }, [chapters, editingRef, performSave])

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
          {modules.length === 0 && chapters.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Start building your course"
              description="Add a module to group related chapters, or add a chapter directly to the course."
            >
              <div className="flex gap-2">
                <Button onClick={openCreateModule}>
                  <FolderPlus />
                  Add module
                </Button>
                <Button variant="outline" onClick={() => addChapter(null)}>
                  <Plus />
                  Add chapter
                </Button>
              </div>
            </EmptyState>
          ) : (
            <DndContext
              id={dndContextId}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              {modules.map((m) => {
                const moduleChapters = chapters.filter(
                  (c) => c.moduleId === m.id,
                )
                return (
                  <div key={m.id} className="mb-4">
                    <SortableContext
                      items={moduleChapters.map((c) => c.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <BuilderModule
                        module={m}
                        chapters={moduleChapters}
                        collapsed={collapsedModuleIds.has(m.id)}
                        onToggleCollapsed={() => toggleModuleCollapsed(m.id)}
                        onEdit={() => openEditModule(m.id)}
                        onRemove={() => setPendingDeleteModuleId(m.id)}
                        onAddChapter={() => addChapter(m.id)}
                        onRenameChapter={renameChapter}
                        onRemoveChapter={removeChapter}
                        onMoveChapter={moveChapter}
                        onAddLesson={addLesson}
                        onRenameLesson={renameLesson}
                        onRemoveLesson={removeLesson}
                        onMoveLesson={moveLesson}
                        onEditLesson={openLessonEditor}
                      />
                    </SortableContext>
                  </div>
                )
              })}

              {looseChapters.length > 0 ? (
                <div className="space-y-3">
                  {modules.length > 0 ? (
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Unassigned chapters
                    </p>
                  ) : null}
                  <SortableContext
                    items={looseChapters.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {looseChapters.map((ch, i) => (
                      <BuilderChapter
                        key={ch.id}
                        chapter={ch}
                        index={i}
                        total={looseChapters.length}
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
                        onMoveLesson={(from, to) =>
                          moveLesson(ch.id, from, to)
                        }
                        onEditLesson={(lesson) =>
                          openLessonEditor(ch.id, lesson as LocalLesson)
                        }
                      />
                    ))}
                  </SortableContext>
                </div>
              ) : null}
            </DndContext>
          )}

          {modules.length > 0 || chapters.length > 0 ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-dashed"
                onClick={openCreateModule}
              >
                <FolderPlus />
                Add module
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-dashed"
                onClick={() => addChapter(null)}
              >
                <Plus />
                Add chapter
              </Button>
            </div>
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
            <DetailRow label="Audience">
              <span className="text-sm">
                {course.audience === 'INTERNAL'
                  ? 'Internal team only'
                  : course.audience === 'BOTH'
                    ? 'Members + internal team'
                    : course.isFree
                      ? 'Members · free for all'
                      : 'Members · enrollment required'}
              </span>
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
        ensureSaved={ensureLessonSaved}
        onChange={(changes) => {
          if (!editingRef) return
          patchLesson(editingRef.chapterId, editingRef.lessonId, changes)
        }}
        onResourceAdded={(resource) => {
          if (!editingRef) return
          // Each resource upload persists immediately on the server;
          // append it to local state + saved snapshot so the dialog
          // sees the new file and isDirty stays accurate.
          const append = (c: LocalChapter): LocalChapter => ({
            ...c,
            lessons: c.lessons.map((l) =>
              l.id === editingRef.lessonId
                ? { ...l, status: 'READY', resources: [...l.resources, resource] }
                : l,
            ),
          })
          patchChapter(editingRef.chapterId, append)
          setSavedSnapshot((prev) =>
            prev.map((c) => (c.id === editingRef.chapterId ? append(c) : c)),
          )
        }}
        onResourceRemoved={(resourceId) => {
          if (!editingRef) return
          // Delete already ran on the server — strip locally and
          // mirror in the saved snapshot.
          const strip = (c: LocalChapter): LocalChapter => ({
            ...c,
            lessons: c.lessons.map((l) =>
              l.id === editingRef.lessonId
                ? {
                    ...l,
                    resources: l.resources.filter((r) => r.id !== resourceId),
                  }
                : l,
            ),
          })
          patchChapter(editingRef.chapterId, strip)
          setSavedSnapshot((prev) =>
            prev.map((c) => (c.id === editingRef.chapterId ? strip(c) : c)),
          )
        }}
        onVideoUploadStarted={(lessonId) => {
          // Optimistic flip: Mux's upchunk finished, the webhook will
          // (within seconds) mark the lesson PROCESSING server-side
          // and then READY. Updating local state to PROCESSING now
          // lights up the badge.
          //
          // Use the functional setter form so we always patch the
          // latest chapters snapshot, even if the closure that
          // called us was captured pre-save (when editingRef still
          // held a tempId).
          const patch = { status: 'PROCESSING' as const }
          const apply = (chs: LocalChapter[]): LocalChapter[] =>
            chs.map((c) => ({
              ...c,
              lessons: c.lessons.map((l) =>
                l.id === lessonId ? { ...l, ...patch } : l,
              ),
            }))
          setChapters(apply)
          setSavedSnapshot(apply)
          // Register the lesson with the post-upload poll tracker so
          // the badge keeps converging even if the optimistic patch
          // above misses or the user closes the dialog.
          setPendingUploadIds((prev) =>
            prev.includes(lessonId) ? prev : [...prev, lessonId],
          )
        }}
        onVideoStatusReady={(lessonId, data) => {
          // VideoSection's self-driving post-upload poll has seen the
          // Mux asset go READY. Patch local state so the badge flips
          // to Ready and the dialog auto-renders the MuxPlayer.
          const patch = {
            status: 'READY' as const,
            durationSeconds: data.durationSeconds,
            muxPlaybackId: data.muxPlaybackId,
          }
          const apply = (chs: LocalChapter[]): LocalChapter[] =>
            chs.map((c) => ({
              ...c,
              lessons: c.lessons.map((l) =>
                l.id === lessonId ? { ...l, ...patch } : l,
              ),
            }))
          setChapters(apply)
          setSavedSnapshot(apply)
        }}
      />

      <AlertDialog
        open={pendingNav !== null}
        onOpenChange={(open) => {
          if (!open) setPendingNav(null)
        }}
      >
        <AlertDialogContent className="overflow-hidden sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits to chapters or lessons. Leave the page
              and they&apos;ll be discarded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay on page</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                proceedAfterDiscard()
              }}
              disabled={saving}
            >
              Discard and leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ModuleDialog
        open={moduleDialogOpen}
        onOpenChange={setModuleDialogOpen}
        mode={editingModule ? 'edit' : 'create'}
        initial={
          editingModule
            ? {
                title: editingModule.title,
                description: editingModule.description,
              }
            : undefined
        }
        onSubmit={onModuleSubmit}
      />

      <AlertDialog
        open={pendingDeleteModuleId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteModuleId(null)
        }}
      >
        <AlertDialogContent className="overflow-hidden sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this module?</AlertDialogTitle>
            <AlertDialogDescription>
              The module will be removed. Chapters inside it become loose
              chapters on this course — no lessons are deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void onModuleDeleteConfirm()
              }}
            >
              Delete module
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

// Compute each chapter's per-parent orderIndex by walking the flat
// list and bucketing per moduleId. The flat array's order is the
// source of truth for display position; scoped orderIndex is just a
// projection for the server.
function withScopedOrder(chapters: LocalChapter[]) {
  const counters = new Map<string | null, number>()
  return chapters.map((c) => {
    const key = c.moduleId
    const idx = counters.get(key) ?? 0
    counters.set(key, idx + 1)
    return { chapter: c, orderIndex: idx }
  })
}

function serialize(chapters: LocalChapter[]): string {
  return JSON.stringify(
    withScopedOrder(chapters).map(({ chapter: c, orderIndex }) => ({
      id: c.tempId ? null : c.id,
      tempId: c.tempId ?? null,
      moduleId: c.moduleId,
      title: c.title,
      orderIndex,
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
    chapters: withScopedOrder(chapters).map(({ chapter: c, orderIndex }) => ({
      id: c.tempId ? undefined : c.id,
      tempId: c.tempId,
      title: c.title.trim() || 'Untitled chapter',
      moduleId: c.moduleId ?? null,
      orderIndex,
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
