'use client'

import { useState, useTransition } from 'react'
import { BadgeCheck, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import {
  type MembershipsData,
  createMembershipAction,
  deleteMembershipAction,
  fetchMemberships,
  updateMembershipAction,
} from '@/app/(admin)/admin/membership/actions'
import type { MembershipListItem } from '@/lib/services/membership-service'

interface MembershipsShellProps {
  initialData: MembershipsData
}

type DialogState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; membership: MembershipListItem }

export function MembershipsShell({ initialData }: MembershipsShellProps) {
  const [items, setItems] = useState(initialData.items)
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' })
  const [pendingDelete, setPendingDelete] = useState<MembershipListItem | null>(
    null,
  )
  const [isDeleting, startDelete] = useTransition()

  async function refresh() {
    const next = await fetchMemberships()
    setItems(next.items)
  }

  function handleDeleted() {
    if (!pendingDelete) return
    const target = pendingDelete
    startDelete(async () => {
      const result = await deleteMembershipAction(target.id)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not delete membership')
        return
      }
      toast.success(`Deleted "${target.name}"`)
      setPendingDelete(null)
      await refresh()
    })
  }

  const hasItems = items.length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Membership"
        description="Tiers that gate which courses each member can see. A course opts into any number of tiers; a member with a tier sees courses in that tier plus free courses and any course with no tiers assigned."
        actions={
          <Button onClick={() => setDialog({ kind: 'create' })}>
            <Plus className="size-4" />
            New membership
          </Button>
        }
      />

      {hasItems ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground">{m.name}</p>
                      {m.description ? (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {m.description}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {m.slug}
                    </code>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.courseCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setDialog({ kind: 'edit', membership: m })
                        }
                        aria-label={`Edit ${m.name}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setPendingDelete(m)}
                        aria-label={`Delete ${m.name}`}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={BadgeCheck}
          title="No memberships yet"
          description="Create a tier to gate which courses members can access."
        >
          <Button onClick={() => setDialog({ kind: 'create' })}>
            <Plus className="size-4" />
            Create your first membership
          </Button>
        </EmptyState>
      )}

      <MembershipDialog
        state={dialog}
        onClose={() => setDialog({ kind: 'closed' })}
        onSaved={async () => {
          setDialog({ kind: 'closed' })
          await refresh()
        }}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{pendingDelete?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && pendingDelete.courseCount > 0
                ? `This membership is assigned to ${pendingDelete.courseCount} course${pendingDelete.courseCount === 1 ? '' : 's'}. Those courses will lose this membership but won't be deleted.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleted}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// =========================================================
// Create / Edit dialog
// =========================================================

interface MembershipDialogProps {
  state: DialogState
  onClose: () => void
  onSaved: () => Promise<void> | void
}

function MembershipDialog({ state, onClose, onSaved }: MembershipDialogProps) {
  const mode = state.kind
  const open = mode !== 'closed'

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Edit membership' : 'New membership'}
          </DialogTitle>
          <DialogDescription>
            Slugs are used in URLs. Leave blank to derive from the name.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <MembershipForm
            key={mode === 'edit' ? state.membership.id : 'create'}
            defaults={mode === 'edit' ? state.membership : null}
            onCancel={onClose}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

interface MembershipFormProps {
  defaults: MembershipListItem | null
  onCancel: () => void
  onSaved: () => Promise<void> | void
}

function MembershipForm({ defaults, onCancel, onSaved }: MembershipFormProps) {
  const [name, setName] = useState(defaults?.name ?? '')
  const [slug, setSlug] = useState(defaults?.slug ?? '')
  const [description, setDescription] = useState(defaults?.description ?? '')
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})
    setFormError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setErrors({ name: ['Name is required'] })
      return
    }

    const formData = new FormData()
    formData.set('name', trimmedName)
    formData.set('slug', slug.trim())
    formData.set('description', description.trim())

    startSave(async () => {
      const result = defaults
        ? await updateMembershipAction(defaults.id, formData)
        : await createMembershipAction(formData)

      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors)
        if (result.error) setFormError(result.error)
        return
      }

      toast.success(defaults ? 'Membership updated' : 'Membership created')
      await onSaved()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="membership-name">Name</Label>
        <Input
          id="membership-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Pro"
          disabled={isSaving}
          autoFocus
          aria-invalid={!!errors.name}
        />
        {errors.name?.[0] ? (
          <p className="text-xs text-destructive">{errors.name[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="membership-slug">Slug</Label>
        <Input
          id="membership-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          placeholder={
            name.trim()
              ? `auto: ${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`
              : 'Auto-derived from name'
          }
          disabled={isSaving}
          aria-invalid={!!errors.slug}
        />
        {errors.slug?.[0] ? (
          <p className="text-xs text-destructive">{errors.slug[0]}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers, and hyphens only.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="membership-description">Description</Label>
        <Textarea
          id="membership-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional. Shown on internal member listings."
          rows={3}
          disabled={isSaving}
        />
      </div>

      {formError ? (
        <p className="text-sm text-destructive">{formError}</p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving…' : defaults ? 'Save changes' : 'Create membership'}
        </Button>
      </DialogFooter>
    </form>
  )
}
