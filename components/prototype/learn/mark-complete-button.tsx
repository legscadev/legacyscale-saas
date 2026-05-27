"use client"

import { useState } from "react"
import { Check, CircleCheck } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

export function MarkCompleteButton({
  initialComplete = false,
}: {
  initialComplete?: boolean
}) {
  const [done, setDone] = useState(initialComplete)

  const toggle = () => {
    const next = !done
    setDone(next)
    toast.success(next ? "Lesson marked complete" : "Marked as incomplete")
  }

  return (
    <Button variant={done ? "secondary" : "default"} onClick={toggle}>
      {done ? <CircleCheck /> : <Check />}
      {done ? "Completed" : "Mark complete"}
    </Button>
  )
}
