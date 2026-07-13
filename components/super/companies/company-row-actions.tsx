'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Copy, Loader2, MoreHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  deleteCompanyAction,
  enterCompanyAction,
  listSnapshotSources,
  snapshotCompanyAction,
  type SnapshotSourceOption,
} from '@/app/(super)/super/companies/actions'

interface CompanyRowActionsProps {
  companyId: string
  companyName: string
  isAgency: boolean
}

export function CompanyRowActions({
  companyId,
  companyName,
  isAgency,
}: CompanyRowActionsProps) {
  const router = useRouter()
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [sources, setSources] = useState<SnapshotSourceOption[]>([])
  const [sourceLoading, setSourceLoading] = useState(false)
  const [selectedSource, setSelectedSource] = useState<string>('')
  const [running, setRunning] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [, startTransition] = useTransition()

  async function openSnapshot() {
    setSnapshotOpen(true)
    setSourceLoading(true)
    try {
      const list = await listSnapshotSources(companyId)
      setSources(list)
      setSelectedSource((prev) => prev || list[0]?.id || '')
    } catch (err) {
      console.error(err)
      toast.error('Could not load source tenants')
    } finally {
      setSourceLoading(false)
    }
  }

  async function runDelete() {
    setDeleting(true)
    try {
      const result = await deleteCompanyAction({
        companyId,
        confirmName: deleteConfirmName,
      })
      if (!result.ok) {
        toast.error(result.error ?? 'Could not delete company')
        return
      }
      toast.success(`Deleted ${companyName}`)
      setDeleteOpen(false)
      setDeleteConfirmName('')
      startTransition(() => router.refresh())
    } catch (err) {
      console.error(err)
      toast.error('Could not delete company')
    } finally {
      setDeleting(false)
    }
  }

  async function runSnapshot() {
    if (!selectedSource) return
    setRunning(true)
    try {
      const result = await snapshotCompanyAction({
        sourceCompanyId: selectedSource,
        targetCompanyId: companyId,
      })
      if (!result.ok) {
        toast.error(result.error ?? 'Snapshot failed')
        return
      }
      const s = result.summary
      toast.success(
        `Cloned ${s?.coursesCopied ?? 0} courses, ${s?.lessonsCopied ?? 0} lessons, and ${s?.categoriesCopied ?? 0} categories into ${companyName}`,
      )
      setSnapshotOpen(false)
      startTransition(() => router.refresh())
    } catch (err) {
      console.error(err)
      toast.error('Snapshot failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <form action={enterCompanyAction}>
        <input type="hidden" name="companyId" value={companyId} />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="gap-1.5"
        >
          Enter
          <ArrowRight className="size-3.5" />
        </Button>
      </form>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`More actions for ${companyName}`}
            />
          }
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-0">
          <DropdownMenuItem
            onClick={() => {
              void openSnapshot()
            }}
          >
            <Copy className="size-4" />
            Clone content into…
          </DropdownMenuItem>
          {isAgency ? null : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-4" />
                Delete company…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Clone content into {companyName}</DialogTitle>
            <DialogDescription>
              Pick a source tenant. Its categories + course catalog
              land as DRAFT in this tenant. Videos + files aren't
              copied over.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="snapshot-source-row">Source tenant</Label>
            {sourceLoading ? (
              <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Loading…
              </div>
            ) : sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other tenants exist — nothing to clone from.
              </p>
            ) : (
              <Select
                value={selectedSource}
                onValueChange={(v) => setSelectedSource(v ?? '')}
                disabled={running}
              >
                <SelectTrigger
                  id="snapshot-source-row"
                  className="w-full"
                >
                  <SelectValue placeholder="Pick a tenant">
                    {(() => {
                      const s = sources.find((x) => x.id === selectedSource)
                      if (!s) return 'Pick a tenant'
                      return `${s.name}${s.isAgency ? ' · Agency' : ''}`
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.isAgency ? ' · Agency' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSnapshotOpen(false)}
              disabled={running}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={runSnapshot}
              disabled={
                running || sources.length === 0 || !selectedSource
              }
            >
              {running ? (
                <>
                  <Loader2 className="animate-spin" />
                  Cloning…
                </>
              ) : (
                'Run snapshot'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(v) => {
          if (deleting) return
          setDeleteOpen(v)
          if (!v) setDeleteConfirmName('')
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Delete {companyName}?
            </DialogTitle>
            <DialogDescription>
              This soft-deletes the tenant. Its content, memberships,
              and per-tenant records stop surfacing on the platform
              immediately. To confirm, type the company name below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`delete-confirm-${companyId}`}>
              Type <span className="font-bold">{companyName}</span> to confirm
            </Label>
            <Input
              id={`delete-confirm-${companyId}`}
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={companyName}
              autoComplete="off"
              disabled={deleting}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDeleteOpen(false)
                setDeleteConfirmName('')
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={runDelete}
              disabled={
                deleting || deleteConfirmName.trim() !== companyName
              }
            >
              {deleting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete company'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
