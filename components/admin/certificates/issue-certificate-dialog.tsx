'use client'

import { useMemo, useState, useTransition } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { issueCertificateAction } from '@/app/(admin)/admin/certificates/actions'
import type {
  MemberPickerOption,
  ModulePickerOption,
} from '@/app/(admin)/admin/certificates/actions'

interface IssueCertificateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: MemberPickerOption[]
  modules: ModulePickerOption[]
  onIssued: () => void
}

export function IssueCertificateDialog({
  open,
  onOpenChange,
  members,
  modules,
  onIssued,
}: IssueCertificateDialogProps) {
  const [memberQuery, setMemberQuery] = useState('')
  const [memberId, setMemberId] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [pending, startTransition] = useTransition()

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return members.slice(0, 50)
    return members
      .filter(
        (m) =>
          m.email.toLowerCase().includes(q) ||
          (m.name?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 50)
  }, [memberQuery, members])

  const groupedModules = useMemo(() => {
    const map = new Map<string, { courseTitle: string; items: ModulePickerOption[] }>()
    for (const m of modules) {
      const entry = map.get(m.courseId) ?? { courseTitle: m.courseTitle, items: [] }
      entry.items.push(m)
      map.set(m.courseId, entry)
    }
    return Array.from(map.values())
  }, [modules])

  function handleSubmit() {
    if (!memberId || !moduleId) {
      toast.error('Pick a member and a module')
      return
    }
    startTransition(async () => {
      const result = await issueCertificateAction(memberId, moduleId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Certificate issued')
      onIssued()
      onOpenChange(false)
      setMemberId('')
      setModuleId('')
      setMemberQuery('')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue certificate</DialogTitle>
          <DialogDescription>
            Hand-issue a certificate to a member for a specific module. This
            bypasses the module-completion check — use for support edge cases
            only. The recipient will see it in their Certificates tab and can
            download it immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Search member</Label>
            <Input
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="Name or email…"
            />
            <Select
              value={memberId}
              onValueChange={(v) => setMemberId(v ?? '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a member" />
              </SelectTrigger>
              <SelectContent>
                {filteredMembers.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No matches
                  </div>
                ) : (
                  filteredMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name?.trim() || m.email}
                      {m.name?.trim() ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {m.email}
                        </span>
                      ) : null}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Module</Label>
            <Select
              value={moduleId}
              onValueChange={(v) => setModuleId(v ?? '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a module" />
              </SelectTrigger>
              <SelectContent>
                {groupedModules.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No cert-enabled courses have modules yet.
                  </div>
                ) : (
                  groupedModules.map((g) => (
                    <SelectGroup key={g.courseTitle}>
                      <SelectLabel>{g.courseTitle}</SelectLabel>
                      {g.items.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? 'Issuing…' : 'Issue certificate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
