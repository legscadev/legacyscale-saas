'use client'

// Notes tab inside the edit-opportunity dialog. Timeline of comments
// (newest first) with add / edit / delete. Distinct from the free-
// text CrmOpportunity.notes field — that stays as a single scratchpad
// on Opportunity details for CSV-imported deals; this timeline is the
// per-touchpoint history GHL calls "Notes".

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  createOpportunityNoteAction,
  deleteOpportunityNoteAction,
  fetchOpportunityNotesAction,
  updateOpportunityNoteAction,
} from '@/app/(admin)/admin/crm/opportunities/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { fmtCalendarDateShort } from '@/lib/format'
import type { OpportunityNoteItem } from '@/lib/services/crm-opportunity-note-service'

interface Props {
  opportunityId: string
  onChanged?: () => void
}

export function OpportunityNotesPanel({ opportunityId, onChanged }: Props) {
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState<OpportunityNoteItem[]>([])
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [body, setBody] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchOpportunityNotesAction(opportunityId).then((res) => {
      if (cancelled) return
      setLoading(false)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not load notes')
        return
      }
      setNotes(res.data)
    })
    return () => {
      cancelled = true
    }
  }, [opportunityId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return notes
    return notes.filter((n) => n.body.toLowerCase().includes(q))
  }, [notes, search])

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) {
      toast.error('Note is empty')
      return
    }
    startTransition(async () => {
      const res = await createOpportunityNoteAction({
        opportunityId,
        body: body.trim(),
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not add note')
        return
      }
      setNotes((prev) => [res.data, ...prev])
      setBody('')
      setAdding(false)
      onChanged?.()
    })
  }

  function startEdit(note: OpportunityNoteItem) {
    setEditingId(note.id)
    setEditBody(note.body)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditBody('')
  }

  function handleUpdate(noteId: string) {
    if (!editBody.trim()) {
      toast.error('Note is empty')
      return
    }
    startTransition(async () => {
      const res = await updateOpportunityNoteAction({
        noteId,
        body: editBody.trim(),
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not update note')
        return
      }
      setNotes((prev) => prev.map((n) => (n.id === noteId ? res.data : n)))
      cancelEdit()
      onChanged?.()
    })
  }

  function handleDelete(noteId: string) {
    startTransition(async () => {
      const res = await deleteOpportunityNoteAction({ noteId })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete note')
        return
      }
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
      onChanged?.()
    })
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Notes</h3>
        {adding ? null : (
          <Button
            type="button"
            size="sm"
            onClick={() => setAdding(true)}
            disabled={pending}
          >
            <Plus className="mr-1.5 size-3.5" />
            Add note
          </Button>
        )}
      </div>

      {adding ? (
        <form
          onSubmit={handleAdd}
          className="space-y-2 rounded-md border bg-muted/20 p-3"
        >
          <Textarea
            autoFocus
            placeholder="Write a note…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={20_000}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false)
                setBody('')
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Saving…' : 'Save note'}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search notes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
          {notes.length === 0
            ? 'No notes yet. Add the first update.'
            : 'No notes match your search.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((note) => (
            <li
              key={note.id}
              className="group rounded-md border bg-card p-3"
            >
              {editingId === note.id ? (
                <div className="space-y-2">
                  <Textarea
                    autoFocus
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={4}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={cancelEdit}
                      disabled={pending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleUpdate(note.id)}
                      disabled={pending}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-snug">
                    {note.body}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {note.author?.name ??
                        note.author?.email.split('@')[0] ??
                        'Unknown'}
                      {' · '}
                      {fmtCalendarDateShort(note.createdAt)}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => startEdit(note)}
                        disabled={pending}
                        aria-label="Edit note"
                        className="size-7"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(note.id)}
                        disabled={pending}
                        aria-label="Delete note"
                        className="size-7 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
