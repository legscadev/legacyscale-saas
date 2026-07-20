'use client'

// Full-page editor for /admin/policies/[id]/edit. Two-column
// layout: content on the left (title + Tiptap body), metadata
// sidebar on the right (category, attachments, save panel).
//
// Save is explicit — no auto-save through 3.2. The Publish button
// lands in 3.3 (wired to publishPolicyAction with an unsaved-
// changes guard). "Back to detail" preserves the read view state.

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ArrowLeft, Check, Folder, Save, Send } from 'lucide-react'
import { toast } from 'sonner'

import {
  publishPolicyAction,
  updatePolicyAction,
  type PolicyDetailPayload,
} from '@/app/(admin)/admin/policies/actions'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { cn } from '@/lib/utils'

import type { PolicyCategoryRef } from '@/app/(admin)/admin/policies/actions'

import { PolicyAttachmentsPanel } from './policy-attachments-panel'
import {
  CategoryChip,
  PolicyStatusPill,
  RevisionBadge,
} from './policy-pills'

interface PolicyEditorProps {
  data: PolicyDetailPayload
  categories: PolicyCategoryRef[]
}

export function PolicyEditor({ data, categories }: PolicyEditorProps) {
  const router = useRouter()
  const { policy, attachments } = data

  const [title, setTitle] = useState(policy.title)
  const [body, setBody] = useState(policy.body ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(
    policy.categoryId,
  )
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, startSave] = useTransition()
  const [isPublishing, startPublish] = useTransition()
  const [, startRefresh] = useTransition()
  const [republishOpen, setRepublishOpen] = useState(false)

  const dirty =
    title !== policy.title ||
    (body || '') !== (policy.body ?? '') ||
    categoryId !== policy.categoryId

  const selectedCategory =
    categoryId === null ? null : categories.find((c) => c.id === categoryId)

  function refresh() {
    startRefresh(() => {
      router.refresh()
    })
  }

  async function saveDraft(): Promise<boolean> {
    setErrors({})
    setFormError(null)
    const res = await updatePolicyAction(policy.id, {
      title: title.trim(),
      body: body.trim() === '' ? null : body,
      categoryId,
    })
    if (!res.ok) {
      if (res.fieldErrors) setErrors(res.fieldErrors)
      else setFormError(res.error ?? 'Could not save policy')
      return false
    }
    return true
  }

  function handleSave() {
    startSave(async () => {
      const ok = await saveDraft()
      if (ok) {
        toast.success('Draft saved')
        refresh()
      }
    })
  }

  /** Publish flow — save pending edits first, then publish. Repub
   *  (already PUBLISHED) prompts a confirmation because the frozen
   *  audience seeing the last revision will see the new one on
   *  their next visit. */
  function requestPublish() {
    if (policy.revision > 0 && policy.status === 'PUBLISHED') {
      setRepublishOpen(true)
      return
    }
    runPublish()
  }

  function runPublish() {
    startPublish(async () => {
      // Save first if there are pending edits — publish snapshots
      // whatever is currently on the Policy row, and losing the
      // last N keystrokes to a publish-without-save would be a
      // nasty foot-gun.
      if (dirty) {
        const savedOk = await saveDraft()
        if (!savedOk) {
          toast.error('Save your changes first — nothing was published')
          return
        }
      }
      const res = await publishPolicyAction(policy.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not publish')
        return
      }
      toast.success(
        policy.revision === 0
          ? 'Published — Rev I cut'
          : `Republished — Rev ${res.data.revision} cut`,
      )
      router.push(`/admin/policies/${policy.id}`)
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit policy"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              render={
                <Link href={`/admin/policies/${policy.id}`}>
                  <ArrowLeft className="size-4" />
                  Back to detail
                </Link>
              }
            />
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={isSaving || isPublishing || !dirty}
            >
              <Save className="size-4" />
              {isSaving ? 'Saving…' : dirty ? 'Save draft' : 'Saved'}
            </Button>
            <Button
              onClick={requestPublish}
              disabled={isSaving || isPublishing || !title.trim()}
            >
              <Send className="size-4" />
              {isPublishing
                ? 'Publishing…'
                : policy.revision === 0
                  ? 'Publish'
                  : 'Republish'}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <PolicyStatusPill status={policy.status} />
        <RevisionBadge revision={policy.revision} />
        {dirty ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            Unsaved changes
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="space-y-1.5">
              <Label htmlFor="policy-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="policy-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sales Trainer — hat write-up"
                required
                maxLength={200}
                aria-invalid={Boolean(errors.title)}
                disabled={isSaving}
              />
              {errors.title ? (
                <p className="text-xs text-destructive">{errors.title[0]}</p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="space-y-1.5">
              <Label htmlFor="policy-body">Body</Label>
              <RichTextEditor
                id="policy-body"
                value={body}
                onChange={setBody}
                placeholder="Write the policy — Purpose, Product, Statistics, Expectations, Tools…"
                disabled={isSaving}
              />
              {errors.body ? (
                <p className="text-xs text-destructive">{errors.body[0]}</p>
              ) : null}
            </div>
          </div>

          {formError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {formError}
            </p>
          ) : null}
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Category
            </h2>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    disabled={isSaving}
                    className={cn(
                      'inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm shadow-xs',
                      'transition-colors hover:bg-accent hover:text-accent-foreground',
                      'disabled:cursor-not-allowed disabled:opacity-50',
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
          </section>

          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Attachments ({attachments.length})
            </h2>
            <PolicyAttachmentsPanel
              policyId={policy.id}
              attachments={attachments}
              onChanged={refresh}
            />
          </section>
        </aside>
      </div>

      <AlertDialog open={republishOpen} onOpenChange={setRepublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cut a new revision?</AlertDialogTitle>
            <AlertDialogDescription>
              This policy is already published as Rev {policy.revision}.
              Republishing snapshots the current body as Rev{' '}
              {policy.revision + 1} and updates the version everyone sees.
              The old revision stays in the timeline and can be reverted to.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setRepublishOpen(false)
                runPublish()
              }}
            >
              Republish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
