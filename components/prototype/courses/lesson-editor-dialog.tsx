"use client"

import { Trash2, UploadCloud } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { StatusBadge } from "@/components/prototype/shared/status-badge"
import { LessonTypeBadge } from "./lesson-type-badge"
import type { Lesson } from "@/lib/prototype"

interface LessonEditorDialogProps {
  lesson: Lesson | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LessonEditorDialog({
  lesson,
  open,
  onOpenChange,
}: LessonEditorDialogProps) {
  if (!lesson) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <LessonTypeBadge type={lesson.type} />
            <StatusBadge status={lesson.status} />
          </div>
          <DialogTitle>Edit lesson</DialogTitle>
          <DialogDescription>
            Configure this {lesson.type.toLowerCase()} lesson.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Title">
            <Input defaultValue={lesson.title} />
          </Field>
          <Field label="Description">
            <Textarea defaultValue={lesson.description} className="min-h-20" />
          </Field>

          {lesson.type === "VIDEO" ? <VideoFields lesson={lesson} /> : null}
          {lesson.type === "RESOURCE" ? (
            <ResourceFields lesson={lesson} />
          ) : null}
          {lesson.type === "QUIZ" ? <QuizFields lesson={lesson} /> : null}
        </div>

        <DialogFooter showCloseButton>
          <Button>Save lesson</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function VideoFields({ lesson }: { lesson: Lesson }) {
  return (
    <Field label="Video">
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 px-6 py-8 text-center">
        <UploadCloud className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">Upload to Mux</p>
        <p className="text-xs text-muted-foreground">
          {lesson.status === "READY"
            ? "Replace the current video — drag & drop or browse"
            : "Drag & drop a video file, or browse"}
        </p>
      </div>
    </Field>
  )
}

function ResourceFields({ lesson }: { lesson: Lesson }) {
  return (
    <Field label="Resource file">
      <Input defaultValue={lesson.resourceName} />
      <p className="text-xs text-muted-foreground">
        Members can download this file from the lesson.
      </p>
    </Field>
  )
}

function QuizFields({ lesson }: { lesson: Lesson }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Pass mark (%)">
          <Input type="number" defaultValue={lesson.passingScore} />
        </Field>
        <Field label="Max attempts">
          <Input type="number" defaultValue={lesson.maxAttempts ?? undefined} />
        </Field>
        <Field label="Time limit (min)">
          <Input type="number" defaultValue={lesson.timeLimitMin ?? undefined} />
        </Field>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Questions</Label>
          <Button variant="outline" size="sm">
            Add question
          </Button>
        </div>
        {(lesson.questions ?? []).map((q, qi) => (
          <div key={q.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Question {qi + 1} · {q.type.replace("_", " ").toLowerCase()}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Remove question"
              >
                <Trash2 />
              </Button>
            </div>
            <Input defaultValue={q.questionText} />
            <div className="space-y-1.5">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name={`correct-${q.id}`}
                    defaultChecked={oi === q.correctIndex}
                    className="accent-[hsl(var(--primary))]"
                  />
                  <Input defaultValue={opt} className="h-7" />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
