'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, Layers, Plus, Sliders } from 'lucide-react'
import { toast } from 'sonner'
import type { CourseStatus } from '@prisma/client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, StatusBadge } from '@/components/shared'
import { cn } from '@/lib/utils'
import { updateCourseAction } from '@/app/(admin)/admin/courses/actions'
import type { CourseDetail } from '@/lib/services/course-service'
import type { ChapterListItem } from '@/lib/services/chapter-service'
import { BuilderChapter } from './builder-chapter'

const STATUSES: { value: CourseStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
]

interface CourseBuilderProps {
  course: CourseDetail
  chapters: ChapterListItem[]
}

type SaveState = 'idle' | 'pending' | 'saved' | 'error'

export function CourseBuilder({ course, chapters }: CourseBuilderProps) {
  const router = useRouter()

  // Sidebar fields — local for snappy typing, debounced sync to server.
  const [title, setTitle] = useState(course.title)
  const [description, setDescription] = useState(course.description ?? '')
  const [status, setStatus] = useState<CourseStatus>(course.status)
  const [save, setSave] = useState<SaveState>('idle')

  const lessonCount = chapters.reduce((n, c) => n + c.lessons.length, 0)

  // Tracks the latest synced values so we don't re-fire on the initial
  // hydration pass or after a successful save.
  const lastSyncedRef = useRef({
    title: course.title,
    description: course.description ?? '',
    status: course.status,
  })

  const flush = useCallback(
    async (
      patch: Partial<{
        title: string
        description: string
        status: CourseStatus
      }>,
    ) => {
      const trimmedTitle = patch.title?.trim()
      if (trimmedTitle !== undefined && trimmedTitle.length === 0) {
        // Don't let the user save an empty title — but don't toast either;
        // they're probably mid-edit. Just skip the round-trip.
        return
      }
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

  // Debounced auto-save for title + description (text inputs).
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
      const patch: Partial<{
        title: string
        description: string
      }> = {}
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

  // Status changes save immediately — they're discrete clicks, not typing.
  const onStatusChange = useCallback(
    (next: CourseStatus) => {
      if (next === status) return
      setStatus(next)
      lastSyncedRef.current = { ...lastSyncedRef.current, status: next }
      void flush({ status: next })
    },
    [status, flush],
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
              <Button disabled title="Available in the next ticket">
                <Plus />
                Add chapter
              </Button>
            </EmptyState>
          ) : (
            chapters.map((ch, i) => (
              <BuilderChapter
                key={ch.id}
                chapter={ch}
                index={i}
                total={chapters.length}
                disabled
              />
            ))
          )}

          {chapters.length > 0 ? (
            <Button
              variant="outline"
              className="w-full border-dashed"
              disabled
              title="Available in the next ticket"
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
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  if (state === 'pending') {
    return (
      <span className="text-xs text-muted-foreground">Saving…</span>
    )
  }
  if (state === 'saved') {
    return <span className="text-xs text-success">Saved</span>
  }
  return <span className="text-xs text-destructive">Failed to save</span>
}
