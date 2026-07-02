'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRight,
  Copy,
  Loader2,
  Plus,
  Star,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/shared'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { TemplateListItem } from '@/lib/services/checklist-template-service'

import { createTemplateAction } from '@/app/(admin)/admin/onboarding/actions'

interface ChecklistsTabProps {
  templates: TemplateListItem[]
}

export function ChecklistsTab({ templates }: ChecklistsTabProps) {
  const [newOpen, setNewOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Reusable checklist definitions. Every employee gets attached to one
          — edits reflect on every attached profile immediately.
        </p>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="mr-1.5 size-4" />
          New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={Copy}
          tone="brand"
          title="No templates yet"
          description="Create a checklist template so every new hire starts from the same set of tasks."
        >
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="mr-1.5 size-4" />
            New template
          </Button>
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <li key={t.id}>
              <TemplateCard template={t} />
            </li>
          ))}
        </ul>
      )}

      <NewTemplateDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  )
}

function TemplateCard({ template }: { template: TemplateListItem }) {
  return (
    <Link
      href={`/admin/onboarding/templates/${template.id}`}
      className={cn(
        'group flex flex-col rounded-xl border bg-card p-4 transition-all',
        'hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-semibold">{template.name}</h3>
            {template.isDefault ? (
              <Star className="size-3.5 fill-amber-400 text-amber-500" />
            ) : null}
          </div>
          {template.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {template.description}
            </p>
          ) : (
            <p className="mt-1 text-sm italic text-muted-foreground">
              No description
            </p>
          )}
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Copy className="size-3" />
          {template.itemCount} items
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="size-3" />
          {template.employeeCount} employees
        </span>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------
// New template dialog — kept as a modal because it's short (3 fields).
// After creation we navigate straight into the editor page so the
// admin lands where they can add items.
// ---------------------------------------------------------------------

function NewTemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [pending, startTransition] = useTransition()

  function reset() {
    setName('')
    setDescription('')
    setIsDefault(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pending) return
    startTransition(async () => {
      try {
        const created = await createTemplateAction({
          name,
          description: description || null,
          isDefault,
        })
        toast.success(`Created ${name}`)
        reset()
        onOpenChange(false)
        router.push(`/admin/onboarding/templates/${created.id}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New checklist template</DialogTitle>
          <DialogDescription>
            Create a named checklist. You&apos;ll add items on the next screen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Setter Onboarding"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-description">Description (optional)</Label>
            <Textarea
              id="tpl-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this checklist is for"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Make this the default template for new employees
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create template'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
