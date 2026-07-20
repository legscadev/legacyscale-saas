'use client'

// Create-policy dialog. Deliberately minimal — title + optional
// category, opens as DRAFT. The rich-text body is filled in on the
// /admin/policies/[id]/edit page (Phase 3), which is where the
// Tiptap editor + attachments + publish flow live. Keeping the
// dialog small means "start a new hat write-up" is a one-click
// path and the operator can iterate on the body without a modal.

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Check, Folder } from 'lucide-react'
import { toast } from 'sonner'

import { createPolicyAction } from '@/app/(admin)/admin/policies/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import type { PolicyCategoryRef } from '@/app/(admin)/admin/policies/actions'

import { CategoryChip } from './policy-pills'

interface CreatePolicyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: PolicyCategoryRef[]
}

export function CreatePolicyDialog({
  open,
  onOpenChange,
  categories,
}: CreatePolicyDialogProps) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()

  function resetForm() {
    setTitle('')
    setCategoryId(null)
    setErrors({})
    setFormError(null)
  }

  const selectedCategory =
    categoryId === null ? null : categories.find((c) => c.id === categoryId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setFormError(null)

    startSave(async () => {
      const res = await createPolicyAction({
        title,
        categoryId: categoryId ?? null,
      })
      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors)
        else setFormError(res.error ?? 'Could not create policy')
        return
      }
      toast.success('Policy created')
      resetForm()
      // Capture the id BEFORE closing — resetForm/onOpenChange
      // may unmount this component and lose `res` from scope.
      const targetId = res.data.id
      // Close dialog directly + navigate. We deliberately skip
      // onCreated()'s router.refresh — the push to /edit fetches
      // fresh data anyway, and refresh + push racing meant the
      // push got cancelled by the pending refresh in earlier
      // testing (dialog closed, row appeared, but /edit didn't
      // load).
      onOpenChange(false)
      router.push(`/admin/policies/${targetId}/edit`)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New policy</DialogTitle>
          <DialogDescription>
            Starts as a draft. Add the body + attachments on the next screen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="policy-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="policy-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sales Trainer — hat write-up"
              autoFocus
              required
              maxLength={200}
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title ? (
              <p className="text-xs text-destructive">{errors.title[0]}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      'inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm shadow-xs',
                      'transition-colors hover:bg-accent hover:text-accent-foreground',
                    )}
                  />
                }
              >
                <span className="flex items-center gap-2">
                  <Folder
                    className="size-3.5 text-muted-foreground"
                    aria-hidden
                  />
                  {selectedCategory ? (
                    <CategoryChip
                      name={selectedCategory.name}
                      color={selectedCategory.color}
                    />
                  ) : (
                    <span className="text-muted-foreground">No category</span>
                  )}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={() => setCategoryId(null)}>
                  <span className="flex-1 text-muted-foreground">
                    No category
                  </span>
                  {categoryId === null ? (
                    <Check className="size-3.5" aria-hidden />
                  ) : null}
                </DropdownMenuItem>
                {categories.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                  >
                    <CategoryChip name={c.name} color={c.color} />
                    {categoryId === c.id ? (
                      <Check className="ml-auto size-3.5" aria-hidden />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !title.trim()}>
              {isSaving ? 'Creating…' : 'Create draft'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
