'use client'

// Comments panel for the task detail drawer. Owns its own local
// list so add/edit/delete reflect immediately without a round trip
// to the parent. The parent still hears about mutations via
// onChanged so the drawer's summary counts stay in sync.
//
// Auth semantics (matching task-comment-service):
//  - Anyone with access to the drawer can add comments.
//  - Only the original author can edit their own comment.
//  - Admins can delete any comment (the drawer is admin-only for
//    Phase 4; will need a per-role gate when a member surface ships).

import { formatDistanceToNow } from 'date-fns'
import { Check, Loader2, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  addCommentAction,
  deleteCommentAction,
  editCommentAction,
} from '@/app/(admin)/admin/tasks/actions'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { TaskCommentRow } from '@/lib/services/task-comment-service'

interface TaskCommentsPanelProps {
  taskId: string
  comments: TaskCommentRow[]
  currentUserId: string
  onChanged?: () => void
}

export function TaskCommentsPanel({
  taskId,
  comments: initial,
  currentUserId,
  onChanged,
}: TaskCommentsPanelProps) {
  // Local copy so add/edit/delete apply immediately. Rebuild from
  // the prop whenever the parent refetches (signature by count +
  // id list — cheap and captures every meaningful change).
  const [comments, setComments] = useState(initial)
  const initialSig = useRef(signatureOf(initial))
  const currentSig = signatureOf(initial)
  if (currentSig !== initialSig.current) {
    initialSig.current = currentSig
    setComments(initial)
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {comments.length === 0 ? (
          <li className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            No comments yet. Start the thread below.
          </li>
        ) : (
          comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              currentUserId={currentUserId}
              onEdited={(next) => {
                setComments((prev) =>
                  prev.map((p) => (p.id === next.id ? next : p)),
                )
                onChanged?.()
              }}
              onDeleted={(id) => {
                setComments((prev) => prev.filter((p) => p.id !== id))
                onChanged?.()
              }}
            />
          ))
        )}
      </ul>

      <CommentComposer
        taskId={taskId}
        onAdded={(row) => {
          setComments((prev) => [...prev, row])
          onChanged?.()
        }}
      />
    </div>
  )
}

// =========================================================
// Composer
// =========================================================

interface CommentComposerProps {
  taskId: string
  onAdded: (row: TaskCommentRow) => void
}

function CommentComposer({ taskId, onAdded }: CommentComposerProps) {
  const [draft, setDraft] = useState('')
  const [isSaving, startSave] = useTransition()

  function submit() {
    const body = draft.trim()
    if (!body) return
    startSave(async () => {
      const res = await addCommentAction({ taskId, body, mentions: [] })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not add comment')
        return
      }
      // The action returns just { id }; synthesize an optimistic
      // row so the thread renders now. The next revalidation will
      // reconcile author/timestamps against the server truth.
      const now = new Date()
      onAdded({
        id: res.data.id,
        taskId,
        body,
        author: null,
        editedAt: null,
        editedBy: null,
        createdAt: now,
      })
      setDraft('')
    })
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-2">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            submit()
          }
        }}
        placeholder="Add a comment… (⌘/Ctrl + Enter to send)"
        rows={2}
        disabled={isSaving}
        className="bg-transparent"
      />
      <div className="flex items-center justify-end gap-2">
        <Button size="sm" onClick={submit} disabled={isSaving || !draft.trim()}>
          {isSaving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
          Comment
        </Button>
      </div>
    </div>
  )
}

// =========================================================
// Single comment
// =========================================================

interface CommentItemProps {
  comment: TaskCommentRow
  currentUserId: string
  onEdited: (next: TaskCommentRow) => void
  onDeleted: (id: string) => void
}

function CommentItem({
  comment,
  currentUserId,
  onEdited,
  onDeleted,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const [isBusy, startBusy] = useTransition()

  useEffect(() => {
    setDraft(comment.body)
  }, [comment.body])

  const isAuthor = comment.author?.id === currentUserId
  const displayName =
    comment.author?.name ??
    comment.author?.email?.split('@')[0] ??
    'System'

  function saveEdit() {
    const next = draft.trim()
    if (!next || next === comment.body) {
      setEditing(false)
      setDraft(comment.body)
      return
    }
    startBusy(async () => {
      const res = await editCommentAction({
        commentId: comment.id,
        body: next,
        mentions: [],
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not edit comment')
        setDraft(comment.body)
        setEditing(false)
        return
      }
      onEdited({
        ...comment,
        body: next,
        editedAt: new Date(),
        editedBy: { id: currentUserId, name: null },
      })
      setEditing(false)
    })
  }

  function remove() {
    startBusy(async () => {
      const res = await deleteCommentAction(comment.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete comment')
        return
      }
      onDeleted(comment.id)
    })
  }

  return (
    <li className="flex gap-2 rounded-md border p-2">
      <Avatar className="size-7 shrink-0">
        <AvatarFallback className="bg-primary text-[10px] font-medium text-primary-foreground">
          {initialsOf(displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-sm font-medium">{displayName}</span>
            <span className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
            </span>
            {comment.editedAt ? (
              <span className="text-[10px] text-muted-foreground italic">
                (edited)
              </span>
            ) : null}
          </div>
          {!editing ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={isBusy}
                render={
                  <button
                    type="button"
                    aria-label="Comment actions"
                    className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  />
                }
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isAuthor ? (
                  <DropdownMenuItem onClick={() => setEditing(true)}>
                    <Pencil className="size-3.5" />
                    Edit
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem variant="destructive" onClick={remove}>
                  <Trash2 className="size-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              autoFocus
              disabled={isBusy}
              className={cn('bg-background')}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={saveEdit} disabled={isBusy}>
                <Check className="size-3.5" />
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(comment.body)
                  setEditing(false)
                }}
                disabled={isBusy}
              >
                <X className="size-3.5" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {comment.body}
          </p>
        )}
      </div>
    </li>
  )
}

// =========================================================
// Helpers
// =========================================================

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function signatureOf(rows: TaskCommentRow[]): string {
  return rows
    .map((r) => `${r.id}:${r.body.length}:${r.editedAt?.getTime() ?? 0}`)
    .join('|')
}
