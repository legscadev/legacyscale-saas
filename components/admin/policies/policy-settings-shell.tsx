'use client'

// Category admin at /admin/policies/settings. One section for now
// (categories); Phase 6.2+ could add labels or audience tags if
// the module grows them. Inline add + edit; delete goes through
// an AlertDialog with an in-use warning when the category is
// currently attached to policies.

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  deletePolicyCategoryAction,
  upsertPolicyCategoryAction,
  type PolicySettingsPayload,
} from '@/app/(admin)/admin/policies/settings/actions'
import { PageHeader } from '@/components/shared/page-header'
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
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { PolicyCategoryListItem } from '@/lib/services/policy-workspace-service'

interface PolicySettingsShellProps {
  initialData: PolicySettingsPayload
}

export function PolicySettingsShell({ initialData }: PolicySettingsShellProps) {
  const [categories, setCategories] = useState(initialData.categories)
  const [isAdding, startAdd] = useTransition()
  const [pending, setPending] = useState<PolicyCategoryListItem | null>(null)
  const [isDeleting, startDelete] = useTransition()

  function handleAdd() {
    startAdd(async () => {
      const res = await upsertPolicyCategoryAction({
        name: 'New category',
        color: '#94a3b8',
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not add category')
        return
      }
      setCategories((prev) => [...prev, res.data])
      toast.success('Category added')
    })
  }

  function confirmDelete() {
    if (!pending) return
    const target = pending
    startDelete(async () => {
      const res = await deletePolicyCategoryAction(target.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete category')
        return
      }
      toast.success(`Deleted "${target.name}"`)
      setCategories((prev) => prev.filter((c) => c.id !== target.id))
      setPending(null)
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: 'Policies', href: '/admin/policies' },
          { label: 'Category settings' },
        ]}
        title="Category settings"
        description="Group policies by function so operators can find hat write-ups fast. Attached policies keep their history when a category is deleted."
        actions={
          <Button
            variant="ghost"
            size="sm"
            render={<Link href="/admin/policies" />}
          >
            <ArrowLeft className="size-4" />
            Back to policies
          </Button>
        }
      />

      <section className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-lg font-semibold tracking-tight">Categories</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Rename, recolor, or delete. Each category is scoped to your
              company.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAdd}
            disabled={isAdding}
          >
            <Plus className="size-4" />
            Add category
          </Button>
        </div>

        <div className="rounded-lg border bg-card">
          {categories.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              No categories yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Color</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-24 text-right">Policies</TableHead>
                  <TableHead className="w-10" aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <CategoryRow
                    key={cat.id}
                    category={cat}
                    onPatched={(next) =>
                      setCategories((prev) =>
                        prev.map((c) => (c.id === next.id ? next : c)),
                      )
                    }
                    onRequestDelete={() => setPending(cat)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{pending?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending && pending.policyCount > 0
                ? `"${pending.name}" is on ${pending.policyCount} polic${pending.policyCount === 1 ? 'y' : 'ies'}. Deleting removes the association; the policies themselves keep their history.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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

function CategoryRow({
  category,
  onPatched,
  onRequestDelete,
}: {
  category: PolicyCategoryListItem
  onPatched: (next: PolicyCategoryListItem) => void
  onRequestDelete: () => void
}) {
  const [isBusy, startBusy] = useTransition()
  const [draftName, setDraftName] = useState(category.name)
  useEffect(() => setDraftName(category.name), [category.name])

  function commitName() {
    const next = draftName.trim()
    if (!next || next === category.name) {
      setDraftName(category.name)
      return
    }
    startBusy(async () => {
      const res = await upsertPolicyCategoryAction({
        id: category.id,
        name: next,
        color: category.color,
      })
      if (!res.ok) {
        toast.error(
          Object.values(res.fieldErrors ?? {}).flat()[0] ??
            res.error ??
            'Could not save',
        )
        setDraftName(category.name)
        return
      }
      onPatched(res.data)
      toast.success(`Renamed to "${res.data.name}"`)
    })
  }

  function commitColor(color: string) {
    if (color === category.color) return
    startBusy(async () => {
      const res = await upsertPolicyCategoryAction({
        id: category.id,
        name: category.name,
        color,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not save')
        return
      }
      onPatched(res.data)
      toast.success(`Updated "${res.data.name}"`)
    })
  }

  return (
    <TableRow className={cn(isBusy && 'opacity-60 transition-opacity')}>
      <TableCell>
        <input
          type="color"
          value={category.color}
          onChange={(e) => commitColor(e.target.value)}
          disabled={isBusy}
          aria-label={`Color for ${category.name}`}
          className="h-8 w-10 cursor-pointer rounded border bg-transparent"
        />
      </TableCell>
      <TableCell>
        <Input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            } else if (e.key === 'Escape') {
              setDraftName(category.name)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          disabled={isBusy}
          className="h-8 text-sm"
        />
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
        {category.policyCount}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRequestDelete}
          disabled={isBusy}
          aria-label={`Delete ${category.name}`}
          className="text-muted-foreground hover:text-destructive"
        >
          {isBusy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </Button>
      </TableCell>
    </TableRow>
  )
}
