'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { AlertCircle, Award, Search } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  issueCertificatesBulkAction,
  listModulesByCourseForCertPicker,
  type CoursePickerOption,
  type MemberPickerOption,
  type ModulePickerRow,
} from '@/app/(admin)/admin/certificates/actions'

interface IssueCertificateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: MemberPickerOption[]
  courses: CoursePickerOption[]
  onIssued: () => void
}

export function IssueCertificateDialog({
  open,
  onOpenChange,
  members,
  courses,
  onIssued,
}: IssueCertificateDialogProps) {
  const [memberQuery, setMemberQuery] = useState('')
  const [memberId, setMemberId] = useState('')
  const [courseId, setCourseId] = useState('')
  const [modules, setModules] = useState<ModulePickerRow[]>([])
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [loadingModules, setLoadingModules] = useState(false)
  const [pending, startTransition] = useTransition()

  // Reset all state whenever the dialog closes so re-opening is fresh.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setMemberQuery('')
      setMemberId('')
      setCourseId('')
      setModules([])
      setSelectedModuleIds(new Set())
    }
    onOpenChange(next)
  }

  // Filtered member list for the picker. Cap to 50 so the dropdown
  // stays snappy even with hundreds of members.
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

  function handleCourseChange(v: string) {
    setCourseId(v)
    // Reset module list eagerly on course change so the previous
    // course's modules never flash inside the wrong context.
    setModules([])
    setSelectedModuleIds(new Set())
  }

  // Load modules for the picked course. Also refetches on member
  // change so the alreadyIssued flags reflect that member's
  // issuances. All setState calls fire from a promise callback (not
  // sync in the effect body), which the set-state-in-effect rule
  // allows.
  useEffect(() => {
    if (!open || !courseId) return
    let cancelled = false
    // Defer the loading flag out of the effect body via a microtask
    // so setState never fires synchronously during render — required
    // by react-hooks/set-state-in-effect. Same trick for the promise
    // callbacks, which the rule already allows.
    queueMicrotask(() => {
      if (!cancelled) setLoadingModules(true)
    })
    listModulesByCourseForCertPicker(courseId, memberId || undefined)
      .then((rows) => {
        if (cancelled) return
        setModules(rows)
        // Preselect every module the member doesn't already have an
        // active cert for — usually what Ruby wants.
        setSelectedModuleIds(
          new Set(rows.filter((r) => !r.alreadyIssued).map((r) => r.id)),
        )
      })
      .catch(() => {
        if (!cancelled) {
          setModules([])
          setSelectedModuleIds(new Set())
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingModules(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, courseId, memberId])

  function toggleModule(id: string) {
    setSelectedModuleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const eligibleModuleIds = modules
    .filter((m) => !m.alreadyIssued)
    .map((m) => m.id)
  const allEligibleSelected =
    eligibleModuleIds.length > 0 &&
    eligibleModuleIds.every((id) => selectedModuleIds.has(id))

  function toggleAll() {
    if (allEligibleSelected) {
      setSelectedModuleIds(new Set())
    } else {
      setSelectedModuleIds(new Set(eligibleModuleIds))
    }
  }

  function handleSubmit() {
    if (!memberId) {
      toast.error('Pick a member')
      return
    }
    if (selectedModuleIds.size === 0) {
      toast.error('Pick at least one module')
      return
    }
    startTransition(async () => {
      const result = await issueCertificatesBulkAction(
        memberId,
        [...selectedModuleIds],
      )
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const skipped = result.results.length - result.issuedCount
      if (result.issuedCount === 0) {
        toast.warning('Nothing issued — all selected modules already have certs')
        return
      }
      toast.success(
        skipped > 0
          ? `${result.issuedCount} certificate${result.issuedCount === 1 ? '' : 's'} issued · ${skipped} skipped`
          : `${result.issuedCount} certificate${result.issuedCount === 1 ? '' : 's'} issued`,
      )
      onIssued()
      handleOpenChange(false)
    })
  }

  const selectedMember = members.find((m) => m.id === memberId)
  const selectedCourse = courses.find((c) => c.id === courseId)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Issue certificates</DialogTitle>
          <DialogDescription>
            Hand-issue certificates for a member. Pick a course, then tick
            the modules you want to cover. Bypasses the module-completion
            gate — use for support edge cases only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* MEMBER — search input + scrollable list. Base UI Select
              closes its popup when focus moves to another input, so a
              combined "search + dropdown" pattern flickers. A single
              always-visible list is simpler and works reliably. */}
          <div className="space-y-2">
            <Label htmlFor="issue-cert-member-search">Member</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="issue-cert-member-search"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                placeholder="Search by name or email…"
                className="pl-9"
              />
            </div>
            {memberId ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {selectedMember?.name?.trim() ||
                      selectedMember?.email ||
                      '—'}
                  </div>
                  {selectedMember?.name?.trim() ? (
                    <div className="truncate text-muted-foreground">
                      {selectedMember.email}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setMemberId('')}
                  className="text-primary hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <ul
                role="listbox"
                aria-label="Members"
                className="max-h-40 overflow-y-auto rounded-md border"
              >
                {filteredMembers.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-muted-foreground">
                    No matches
                  </li>
                ) : (
                  filteredMembers.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={memberId === m.id}
                        onClick={() => setMemberId(m.id)}
                        className="flex w-full flex-col items-start border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
                      >
                        <span>
                          {m.name?.trim() || m.email.split('@')[0]}
                        </span>
                        {m.name?.trim() ? (
                          <span className="text-xs text-muted-foreground">
                            {m.email}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {/* COURSE */}
          <div className="space-y-2">
            <Label htmlFor="issue-cert-course">Course</Label>
            <Select
              value={courseId}
              onValueChange={(v) => handleCourseChange(v ?? '')}
            >
              <SelectTrigger id="issue-cert-course" className="w-full">
                <SelectValue placeholder="Choose a course">
                  {(v: string) => {
                    if (!v) return 'Choose a course'
                    const c = courses.find((x) => x.id === v)
                    return c?.title ?? 'Choose a course'
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {courses.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No courses yet
                  </div>
                ) : (
                  courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex flex-col">
                        <span className="text-sm">{c.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.moduleCount} module{c.moduleCount === 1 ? '' : 's'}
                          {c.certificateEnabled ? '' : ' · certs disabled'}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedCourse && !selectedCourse.certificateEnabled ? (
              <p className="flex items-start gap-1.5 text-xs text-amber-600">
                <AlertCircle className="mt-0.5 size-3 shrink-0" />
                This course has certificates disabled globally — a hand-issue
                still works, but auto-issue won&apos;t fire for other members.
              </p>
            ) : null}
          </div>

          {/* MODULES */}
          {courseId ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Modules</Label>
                {eligibleModuleIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-primary hover:underline"
                  >
                    {allEligibleSelected ? 'Clear selection' : 'Select all'}
                  </button>
                ) : null}
              </div>
              {loadingModules ? (
                <div className="rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground">
                  Loading modules…
                </div>
              ) : modules.length === 0 ? (
                <div className="rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground">
                  This course has no modules yet.
                </div>
              ) : (
                <ul className="max-h-56 overflow-y-auto rounded-md border">
                  {modules.map((m) => {
                    const checked = selectedModuleIds.has(m.id)
                    const disabled = m.alreadyIssued
                    return (
                      <li
                        key={m.id}
                        className="flex items-start gap-3 border-b px-3 py-2 last:border-b-0"
                      >
                        <Checkbox
                          id={`module-${m.id}`}
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={() => toggleModule(m.id)}
                          className="mt-0.5"
                        />
                        <label
                          htmlFor={`module-${m.id}`}
                          className="min-w-0 flex-1 cursor-pointer text-sm"
                        >
                          <div className="truncate">{m.title}</div>
                          {m.alreadyIssued ? (
                            <div className="flex items-center gap-1 text-xs text-success">
                              <Award className="size-3" />
                              Already issued
                            </div>
                          ) : m.hasRevokedIssuance ? (
                            <div className="text-xs text-amber-600">
                              Revoked — reinstate from the row menu instead
                            </div>
                          ) : null}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={pending || selectedModuleIds.size === 0 || !memberId}
          >
            {pending
              ? 'Issuing…'
              : selectedModuleIds.size > 1
                ? `Issue ${selectedModuleIds.size} certificates`
                : 'Issue certificate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
