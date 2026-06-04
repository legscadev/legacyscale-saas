'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ExternalLink,
  Layers,
  Plus,
  Sliders,
} from 'lucide-react'
import { toast } from 'sonner'
import type { CourseStatus } from '@prisma/client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { cn } from '@/lib/utils'
import { updateCourseAction } from '@/app/(admin)/admin/courses/actions'
import {
  createChapterAction,
  deleteChapterAction,
  reorderChaptersAction,
  updateChapterAction,
} from '@/app/(admin)/admin/courses/[id]/actions'
import type { CourseDetail } from '@/lib/services/course-service'
import type { ChapterListItem } from '@/lib/services/chapter-service'
import { BuilderChapter } from './builder-chapter'

const STATUSES: { value: CourseStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const CHAPTER_RENAME_DEBOUNCE_MS = 500

interface CourseBuilderProps {
  course: CourseDetail
  chapters: ChapterListItem[]
}

type SaveState = 'idle' | 'pending' | 'saved' | 'error'

interface PendingDelete {
  id: string
  title: string
  lessonsCount: number
}

export function CourseBuilder({
  course,
  chapters: initialChapters,
}: CourseBuilderProps) {
  const router = useRouter()

  // Sidebar fields — local for snappy typing, debounced sync to server.
  const [title, setTitle] = useState(course.title)
  const [description, setDescription] = useState(course.description ?? '')
  const [status, setStatus] = useState<CourseStatus>(course.status)
  const [save, setSave] = useState<SaveState>('idle')

  const [chapters, setChapters] = useState<ChapterListItem[]>(initialChapters)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [addingChapter, setAddingChapter] = useState(false)

  const lessonCount = chapters.reduce((n, c) => n + c.lessons.length, 0)

  const lastSyncedRef = useRef({
    title: course.title,
    description: course.description ?? '',
    status: course.status,
  })

  // Per-chapter rename debounce timers, keyed by chapter id.
  const renameTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  )

  useEffect(() => {
    const timers = renameTimers.current
    return () => {
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
    }
  }, [])

  const flush = useCallback(
    async (
      patch: Partial<{
        title: string
        description: string
        status: CourseStatus
      }>,
    ) => {
      const trimmedTitle = patch.title?.trim()
      if (trimmedTitle !== undefined && trimmedTitle.length === 0) return

      setSave('pending')
      const formData = new FormData()
      if (trimmedTitle !== undefined) formData.set('title', trimmedTitle)
      if (patch.description !== undefined) {
        formData.set('description', patch.description.trim())
      }
      if (patch.status !== undefined) formData.set('status', patch.status)

      try {
        const result = await updateCourseAction(course.id, formData)
        if (!result.ok) {
          setSave('error')
          toast.error(result.error ?? 'Could not save changes')
          return
        }
        setSave('saved')
        router.refresh()
      } catch (err) {
        console.error(err)
        setSave('error')
        toast.error('Network error — please try again')
      }
    },
    [course.id, router],
  )

  // Debounced auto-save for title + description.
  useEffect(() => {
    const trimmedTitle = title.trim()
    const trimmedDescription = description.trim()
    const last = lastSyncedRef.current
    if (
      trimmedTitle === last.title &&
      trimmedDescription === (last.description ?? '')
    ) {
      return
    }
    const timer = setTimeout(() => {
      const patch: Partial<{ title: string; description: string }> = {}
      if (trimmedTitle !== last.title) patch.title = trimmedTitle
      if (trimmedDescription !== (last.description ?? '')) {
        patch.description = trimmedDescription
      }
      lastSyncedRef.current = {
        ...last,
        title: trimmedTitle || last.title,
        description: trimmedDescription,
      }
      void flush(patch)
    }, 600)
    return () => clearTimeout(timer)
  }, [title, description, flush])

  const onStatusChange = useCallback(
    (next: CourseStatus) => {
      if (next === status) return
      setStatus(next)
      lastSyncedRef.current = { ...lastSyncedRef.current, status: next }
      void flush({ status: next })
    },
    [status, flush],
  )

  // -------------------------------------------------------
  // Chapter operations
  // -------------------------------------------------------

  const addChapter = useCallback(async () => {
    if (addingChapter) return
    setAddingChapter(true)
    try {
      const result = await createChapterAction(course.id)
      if (!result.ok || !result.chapter) {
        toast.error(result.error ?? 'Could not add chapter')
        return
      }
      setChapters((prev) => [...prev, result.chapter!])
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error('Network error — please try again')
    } finally {
      setAddingChapter(false)
    }
  }, [addingChapter, course.id, router])

  const renameChapter = useCallback(
    (id: string, nextTitle: string) => {
      // Optimistic local update — keeps the input snappy.
      setChapters((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: nextTitle } : c)),
      )

      // Skip empty titles; the schema requires min(1) and we don't want
      // to wipe a chapter title every time the user holds backspace.
      const trimmed = nextTitle.trim()
      const timers = renameTimers.current
      const existing = timers.get(id)
      if (existing) clearTimeout(existing)
      if (trimmed.length === 0) return

      timers.set(
        id,
        setTimeout(async () => {
          timers.delete(id)
          const result = await updateChapterAction(id, { title: trimmed })
          if (!result.ok) {
            toast.error(result.error ?? 'Could not save chapter title')
            return
          }
        }, CHAPTER_RENAME_DEBOUNCE_MS),
      )
    },
    [],
  )

  const performDelete = useCallback(
    async (id: string) => {
      const original = chapters
      setChapters((prev) => prev.filter((c) => c.id !== id))
      try {
        const result = await deleteChapterAction(id, course.id)
        if (!result.ok) {
          setChapters(original)
          toast.error(result.error ?? 'Could not delete chapter')
          return
        }
        toast.success('Chapter deleted')
        router.refresh()
      } catch (err) {
        console.error(err)
        setChapters(original)
        toast.error('Network error — please try again')
      }
    },
    [chapters, course.id, router],
  )

  const requestDelete = useCallback(
    (chapter: ChapterListItem) => {
      // Empty chapters delete immediately to keep the inline flow snappy;
      // chapters with lessons get a confirmation since cascade removes
      // them along with any uploaded media.
      if (chapter.lessons.length === 0) {
        void performDelete(chapter.id)
        return
      }
      setPendingDelete({
        id: chapter.id,
        title: chapter.title,
        lessonsCount: chapter.lessons.length,
      })
    },
    [performDelete],
  )

  const moveChapter = useCallback(
    async (id: string, dir: -1 | 1) => {
      const index = chapters.findIndex((c) => c.id === id)
      if (index === -1) return
      const target = index + dir
      if (target < 0 || target >= chapters.length) return

      const original = chapters
      const next = [...chapters]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved!)
      setChapters(next)

      try {
        const result = await reorderChaptersAction(
          course.id,
          next.map((c) => c.id),
        )
        if (!result.ok) {
          setChapters(original)
          toast.error(result.error ?? 'Could not reorder chapters')
        }
      } catch (err) {
        console.error(err)
        setChapters(original)
        toast.error('Network error — please try again')
      }
    },
    [chapters, course.id],
  )

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        render={<Link href="/admin/courses" />}
      >
        <ArrowLeft />
        All courses
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {title.trim() || 'Untitled course'}
          </h1>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator state={save} />
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/admin/courses/${course.id}/edit`} />}
          >
            <Sliders />
            More settings
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
              <Button onClick={addChapter} disabled={addingChapter}>
                <Plus />
                {addingChapter ? 'Adding…' : 'Add chapter'}
              </Button>
            </EmptyState>
          ) : (
            chapters.map((ch, i) => (
              <BuilderChapter
                key={ch.id}
                chapter={ch}
                index={i}
                total={chapters.length}
                onRename={(t) => renameChapter(ch.id, t)}
                onRemove={() => requestDelete(ch)}
                onMove={(dir) => moveChapter(ch.id, dir)}
              />
            ))
          )}

          {chapters.length > 0 ? (
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={addChapter}
              disabled={addingChapter}
            >
              <Plus />
              {addingChapter ? 'Adding…' : 'Add chapter'}
            </Button>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="gap-4 p-5">
            <p className="text-sm font-semibold">Course details</p>

            <div className="space-y-1.5">
              <Label htmlFor="course-title">Title</Label>
              <Input
                id="course-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 7-Figure Agency Program"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="course-description">Description</Label>
              <Textarea
                id="course-description"
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
                    key={s.value}
                    type="button"
                    onClick={() => onStatusChange(s.value)}
                    className={cn(
                      'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                      s.value === status
                        ? 'bg-primary/10 text-primary'
                        : 'border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

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
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              <ExternalLink className="size-3" />
              Thumbnail, access duration, delete
            </Link>
          </Card>
        </aside>
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingDelete?.title || 'this chapter'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the chapter and its{' '}
              {pendingDelete?.lessonsCount}{' '}
              {pendingDelete?.lessonsCount === 1 ? 'lesson' : 'lessons'}.
              Video files will remain on Mux until manually removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (!pendingDelete) return
                const id = pendingDelete.id
                setPendingDelete(null)
                void performDelete(id)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete chapter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  if (state === 'pending') {
    return <span className="text-xs text-muted-foreground">Saving…</span>
  }
  if (state === 'saved') {
    return <span className="text-xs text-success">Saved</span>
  }
  return <span className="text-xs text-destructive">Failed to save</span>
}
