'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  listEnrolledCoursesForNudge,
  sendNudgeAction,
  type NudgeCoursePickerOption,
} from '@/app/(admin)/admin/members/nudge-actions'

const NO_COURSE = '__none__'
const MAX_MESSAGE_LEN = 1000

interface NudgeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberId: string
  memberName: string
}

export function NudgeDialog(props: NudgeDialogProps) {
  // Force a fresh child instance on every open so state resets to
  // its initial values — cleaner than useEffect-based resets and
  // sidesteps the "no setState in an effect" rule.
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <NudgeDialogBody key={props.open ? `${props.memberId}` : 'closed'} {...props} />
    </Dialog>
  )
}

function NudgeDialogBody({
  onOpenChange,
  memberId,
  memberName,
}: NudgeDialogProps) {
  const [courses, setCourses] = useState<NudgeCoursePickerOption[]>([])
  const [courseId, setCourseId] = useState<string>(NO_COURSE)
  const [message, setMessage] = useState(defaultMessage(memberName))
  const [pending, startTransition] = useTransition()

  // Load enrolled courses once on mount. setState fires from a
  // promise callback (async) — allowed by set-state-in-effect.
  useEffect(() => {
    let cancelled = false
    listEnrolledCoursesForNudge(memberId)
      .then((rows) => {
        if (!cancelled) setCourses(rows)
      })
      .catch(() => {
        if (!cancelled) setCourses([])
      })
    return () => {
      cancelled = true
    }
  }, [memberId])

  function handleSubmit() {
    const trimmed = message.trim()
    if (!trimmed) {
      toast.error('Message is required')
      return
    }
    startTransition(async () => {
      const result = await sendNudgeAction(
        memberId,
        courseId === NO_COURSE ? null : courseId,
        trimmed,
      )
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      if (result.emailed) {
        toast.success(`Nudge sent to ${memberName || 'member'}`)
      } else {
        toast.warning(
          'Nudge saved — email delivery failed, banner will still show on next login',
        )
      }
      onOpenChange(false)
    })
  }

  return (
    <>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send a nudge</DialogTitle>
          <DialogDescription>
            Sends {memberName ? <strong>{memberName}</strong> : 'the member'} an
            email and shows a dismissible banner on their next visit. Use it to
            re-engage members who&apos;ve stalled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Target course (optional)</Label>
            <Select
              value={courseId}
              onValueChange={(v) => setCourseId(v ?? NO_COURSE)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COURSE}>
                  No target — go to dashboard
                </SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {courses.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No active enrollments — nudge will link to the dashboard.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="nudge-message">Message</Label>
            <Textarea
              id="nudge-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LEN))}
              rows={5}
              placeholder="A short, friendly note. Personal is better than templated."
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/{MAX_MESSAGE_LEN}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? 'Sending…' : 'Send nudge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </>
  )
}

function defaultMessage(memberName: string): string {
  const first = memberName?.trim().split(/\s+/)[0] ?? ''
  return first
    ? `Hey ${first} — just checking in. Want to jump back in and keep the momentum going?`
    : `Just checking in — want to jump back in and keep the momentum going?`
}
