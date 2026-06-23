'use client'

import { useState, useTransition } from 'react'
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react'
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
  type CategoriesData,
  createCategoryAction,
  deleteCategoryAction,
  fetchCategories,
  updateCategoryAction,
} from '@/app/(admin)/admin/categories/actions'
import type { CategoryListItem } from '@/lib/services/category-service'

interface CategoriesShellProps {
  initialData: CategoriesData
}

type DialogState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; category: CategoryListItem }

export function CategoriesShell({ initialData }: CategoriesShellProps) {
  const [items, setItems] = useState(initialData.items)
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' })
  const [pendingDelete, setPendingDelete] = useState<CategoryListItem | null>(
    null,
  )
  const [isDeleting, startDelete] = useTransition()

  async function refresh() {
    const next = await fetchCategories()
    setItems(next.items)
  }

  function handleDeleted() {
    if (!pendingDelete) return
    const target = pendingDelete
    startDelete(async () => {
      const result = await deleteCategoryAction(target.id)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not delete category')
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
        title="Categories"
        description="Group courses for browsing and SEO. A course can belong to any number of categories."
        actions={
          <Button onClick={() => setDialog({ kind: 'create' })}>
            <Plus className="size-4" />
            New category
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
              {items.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground">{cat.name}</p>
                      {cat.description ? (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {cat.description}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {cat.slug}
                    </code>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {cat.courseCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDialog({ kind: 'edit', category: cat })}
                        aria-label={`Edit ${cat.name}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setPendingDelete(cat)}
                        aria-label={`Delete ${cat.name}`}
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
          icon={Tag}
          title="No categories yet"
          description="Categories help members browse the library and improve discoverability."
        >
          <Button onClick={() => setDialog({ kind: 'create' })}>
            <Plus className="size-4" />
            Create your first category
          </Button>
        </EmptyState>
      )}

      <CategoryDialog
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
                ? `This category is assigned to ${pendingDelete.courseCount} course${pendingDelete.courseCount === 1 ? '' : 's'}. Those courses will lose this category but won't be deleted.`
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

interface CategoryDialogProps {
  state: DialogState
  onClose: () => void
  onSaved: () => Promise<void> | void
}

function CategoryDialog({ state, onClose, onSaved }: CategoryDialogProps) {
  const mode = state.kind
  const open = mode !== 'closed'

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Edit category' : 'New category'}
          </DialogTitle>
          <DialogDescription>
            Slugs are used in URLs. Leave blank to derive from the name.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <CategoryForm
            key={mode === 'edit' ? state.category.id : 'create'}
            defaults={mode === 'edit' ? state.category : null}
            onCancel={onClose}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

interface CategoryFormProps {
  defaults: CategoryListItem | null
  onCancel: () => void
  onSaved: () => Promise<void> | void
}

function CategoryForm({ defaults, onCancel, onSaved }: CategoryFormProps) {
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
        ? await updateCategoryAction(defaults.id, formData)
        : await createCategoryAction(formData)

      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors)
        if (result.error) setFormError(result.error)
        return
      }

      toast.success(defaults ? 'Category updated' : 'Category created')
      await onSaved()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="category-name">Name</Label>
        <Input
          id="category-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Marketing"
          disabled={isSaving}
          autoFocus
          aria-invalid={!!errors.name}
        />
        {errors.name?.[0] ? (
          <p className="text-xs text-destructive">{errors.name[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="category-slug">Slug</Label>
        <Input
          id="category-slug"
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
        <Label htmlFor="category-description">Description</Label>
        <Textarea
          id="category-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional. Shown on category browse pages."
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
          {isSaving ? 'Saving…' : defaults ? 'Save changes' : 'Create category'}
        </Button>
      </DialogFooter>
    </form>
  )
}
