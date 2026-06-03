'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Archive,
  ArchiveRestore,
  Edit3,
  ExternalLink,
  MoreHorizontal,
  Send,
  Trash2,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { CourseStatus } from '@prisma/client'

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface CourseActionsMenuProps {
  courseId: string
  courseTitle: string
  status: CourseStatus
  isDeleted: boolean
  onRefetch: () => void
}

export function CourseActionsMenu({
  courseId,
  courseTitle,
  status,
  isDeleted,
  onRefetch,
}: CourseActionsMenuProps) {
  const router = useRouter()
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [pending, setPending] = useState(false)

  async function setStatus(next: CourseStatus, successMessage: string) {
    setPending(true)
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Could not update course')
        return
      }
      toast.success(successMessage)
      onRefetch()
    } catch (err) {
      console.error(err)
      toast.error('Network error — please try again')
    } finally {
      setPending(false)
      setConfirmingArchive(false)
    }
  }

  async function softDelete() {
    setPending(true)
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Could not delete course')
        return
      }
      toast.success(`${courseTitle} deleted`, {
        description: 'You can restore it from the Deleted view.',
      })
      onRefetch()
    } catch (err) {
      console.error(err)
      toast.error('Network error — please try again')
    } finally {
      setPending(false)
      setConfirmingDelete(false)
    }
  }

  async function restore() {
    setPending(true)
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/restore`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Could not restore course')
        return
      }
      toast.success(`${courseTitle} restored`)
      onRefetch()
    } catch (err) {
      console.error(err)
      toast.error('Network error — please try again')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Open actions"
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {isDeleted ? (
            <DropdownMenuItem onClick={restore} disabled={pending}>
              <Undo2 />
              Restore course
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem
                onClick={() => router.push(`/admin/courses/${courseId}`)}
              >
                <ExternalLink />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/admin/courses/${courseId}/edit`)}
              >
                <Edit3 />
                Edit details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {status === 'PUBLISHED' ? (
                <DropdownMenuItem
                  onClick={() => setStatus('DRAFT', `${courseTitle} unpublished`)}
                  disabled={pending}
                >
                  <Send />
                  Unpublish
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => setStatus('PUBLISHED', `${courseTitle} published`)}
                  disabled={pending}
                >
                  <Send />
                  Publish
                </DropdownMenuItem>
              )}
              {status === 'ARCHIVED' ? (
                <DropdownMenuItem
                  onClick={() => setStatus('DRAFT', `${courseTitle} unarchived`)}
                  disabled={pending}
                >
                  <ArchiveRestore />
                  Unarchive
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => setConfirmingArchive(true)}
                  className="text-destructive"
                >
                  <Archive />
                  Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => setConfirmingDelete(true)}
                className="text-destructive"
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirmingArchive}
        onOpenChange={setConfirmingArchive}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {courseTitle}?</AlertDialogTitle>
            <AlertDialogDescription>
              {status === 'PUBLISHED'
                ? "This course will be hidden from members and they'll lose access until you unarchive or unpublish."
                : 'This course will be moved to the archived list. You can unarchive it later.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                setStatus('ARCHIVED', `${courseTitle} archived`)
              }}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? 'Archiving…' : 'Archive course'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {courseTitle}?</AlertDialogTitle>
            <AlertDialogDescription>
              The course and its chapters will be hidden everywhere. You can
              restore it later from the Deleted view. Enrollments are
              preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                softDelete()
              }}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? 'Deleting…' : 'Delete course'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
