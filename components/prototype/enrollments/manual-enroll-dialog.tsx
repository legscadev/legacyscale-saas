"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { courses, findCourse, findMember, members } from "@/lib/prototype"

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

const ACCESS_OPTIONS = [
  { value: "lifetime", label: "Lifetime" },
  { value: "365", label: "1 year" },
  { value: "90", label: "90 days" },
  { value: "30", label: "30 days" },
]

export function ManualEnrollDialog() {
  const [open, setOpen] = useState(false)
  const [memberId, setMemberId] = useState("")
  const [courseId, setCourseId] = useState("")
  const [access, setAccess] = useState("lifetime")

  const submit = () => {
    if (!memberId || !courseId) {
      toast.error("Select a member and a course.")
      return
    }
    const member = findMember(memberId)
    const course = findCourse(courseId)
    toast.success(`Enrolled ${member?.name ?? "member"} in ${course?.title ?? "course"}`)
    setOpen(false)
    setMemberId("")
    setCourseId("")
    setAccess("lifetime")
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Manual enroll
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manually enroll a member</DialogTitle>
            <DialogDescription>
              Grant a member immediate access to a course.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="enroll-member">Member</Label>
              <select
                id="enroll-member"
                className={SELECT_CLASS}
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
              >
                <option value="" disabled>
                  Select a member
                </option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enroll-course">Course</Label>
              <select
                id="enroll-course"
                className={SELECT_CLASS}
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                <option value="" disabled>
                  Select a course
                </option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enroll-access">Access</Label>
              <select
                id="enroll-access"
                className={SELECT_CLASS}
                value={access}
                onChange={(e) => setAccess(e.target.value)}
              >
                {ACCESS_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Enroll member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
