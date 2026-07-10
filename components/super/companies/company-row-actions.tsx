'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Copy, Loader2, MoreHorizontal } from 'lucide-react'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  enterCompanyAction,
  listSnapshotSources,
  snapshotCompanyAction,
  type SnapshotSourceOption,
} from '@/app/(super)/super/companies/actions'

interface CompanyRowActionsProps {
  companyId: string
  companyName: string
}

export function CompanyRowActions({
  companyId,
  companyName,
}: CompanyRowActionsProps) {
  const router = useRouter()
  const [snapshotOpen, setSnapshotOpen] = useState(false)
  const [sources, setSources] = useState<SnapshotSourceOption[]>([])
  const [sourceLoading, setSourceLoading] = useState(false)
  const [selectedSource, setSelectedSource] = useState<string>('')
  const [running, setRunning] = useState(false)
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
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              void openSnapshot()
            }}
          >
            <Copy className="size-4" />
            Clone content into…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}>
        <DialogContent className="sm:max-w-md">
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
                <SelectTrigger id="snapshot-source-row">
                  <SelectValue />
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
    </div>
  )
}
