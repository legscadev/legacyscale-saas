'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

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
import { Button } from '@/components/ui/button'
import { softDeleteCourseAction } from '@/app/(admin)/admin/courses/actions'

interface CourseDeleteButtonProps {
  courseId: string
  courseTitle: string
}

export function CourseDeleteButton({
  courseId,
  courseTitle,
}: CourseDeleteButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setPending(true)
    try {
      const result = await softDeleteCourseAction(courseId)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not delete course')
        return
      }
      toast.success(`${courseTitle} deleted`, {
        description: 'You can restore it from the Deleted view.',
      })
      router.push('/admin/courses')
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error('Network error — please try again')
    } finally {
      setPending(false)
      setOpen(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        <Trash2 />
        Delete course
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
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
                confirm()
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
