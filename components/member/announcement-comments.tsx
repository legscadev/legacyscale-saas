'use client'

import { useState, useTransition } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Role } from '@prisma/client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  createCommentAction,
  deleteCommentAction,
} from '@/app/(user)/announcements/actions'

interface Comment {
  id: string
  body: string
  createdAt: Date
  updatedAt: Date
  user: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
    role: Role
  }
}

interface CommentsSectionProps {
  announcementId: string
  comments: Comment[]
  viewerUserId: string
  viewerRole: Role
}

const COMMENT_MAX = 2000

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function initials(name: string | null, email: string): string {
  const source = (name?.trim() || email).trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export function CommentsSection({
  announcementId,
  comments,
  viewerUserId,
  viewerRole,
}: CommentsSectionProps) {
  const [draft, setDraft] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const canModerate = viewerRole === 'ADMIN' || viewerRole === 'TEAM'

  function submit() {
    const trimmed = draft.trim()
    if (!trimmed) {
      setFieldError('Write a comment')
      return
    }
    if (trimmed.length > COMMENT_MAX) {
      setFieldError(`Too long (${COMMENT_MAX} max)`)
      return
    }
    setFieldError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('body', trimmed)
      const res = await createCommentAction(announcementId, fd)
      if (!res.ok) {
        if (res.fieldErrors?.body?.[0]) setFieldError(res.fieldErrors.body[0])
        else if (res.error) toast.error(res.error)
        return
      }
      setDraft('')
    })
  }

  function remove(commentId: string) {
    startTransition(async () => {
      const res = await deleteCommentAction(announcementId, commentId)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete comment')
        return
      }
      toast.success('Comment deleted')
    })
  }

  return (
    <Card className="gap-4 p-5">
      <h2 className="text-base font-semibold">
        {comments.length === 0
          ? 'Be the first to comment'
          : `${comments.length} comment${comments.length === 1 ? '' : 's'}`}
      </h2>

      <ul className="space-y-3">
        {comments.map((c) => {
          const isOwner = c.user.id === viewerUserId
          const canDelete = isOwner || canModerate
          return (
            <li
              key={c.id}
              className="flex items-start gap-3 rounded-md border bg-muted/20 p-3"
            >
              <div
                className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary"
                aria-hidden="true"
              >
                {c.user.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={c.user.avatarUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  initials(c.user.name, c.user.email)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium">
                    {c.user.name?.trim() || c.user.email}
                  </span>
                  {c.user.role !== 'MEMBER' ? (
                    <span className="inline-flex h-4 items-center rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {c.user.role === 'ADMIN' ? 'Admin' : 'Team'}
                    </span>
                  ) : null}
                  <span
                    className="text-xs text-muted-foreground"
                    suppressHydrationWarning
                  >
                    · {formatTime(c.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
                  {c.body}
                </p>
              </div>
              {canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete comment"
                  onClick={() => remove(c.id)}
                  disabled={pending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className="space-y-1.5">
        <Textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (fieldError) setFieldError(null)
          }}
          placeholder="Add a comment…"
          rows={3}
          disabled={pending}
          className={cn(fieldError && 'border-destructive')}
        />
        {fieldError ? (
          <p className="text-xs text-destructive" role="alert">
            {fieldError}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {draft.length.toLocaleString()} / {COMMENT_MAX.toLocaleString()}
          </p>
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={pending || !draft.trim()}
          >
            <Send className="size-3.5" />
            {pending ? 'Posting…' : 'Post comment'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
