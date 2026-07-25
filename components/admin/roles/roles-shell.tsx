'use client'

// /admin/roles — inline permission matrix. Roles are rows, modules
// are columns grouped by sidebar section, each cell is a checkbox
// that toggles that role's access to that module. Saves happen
// per-toggle (optimistic UI + rollback on error). Per-section
// "Select all" toggles let admins grant an entire section for a
// role in one click.
//
// System roles (seeded 'admin', 'internal-team', + per-user
// 'legacy' shims) can be renamed and their permissions toggled but
// not deleted.

import { useMemo, useState, useTransition } from 'react'
import { Pencil, Plus, ShieldCheck, ShieldPlus, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'

import {
  createRoleAction,
  deleteRoleAction,
  updateRoleAction,
  type RoleSummary,
} from '@/app/(admin)/admin/roles/actions'
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
import { Badge } from '@/components/ui/badge'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  MODULE_SECTIONS,
  type ModuleSection,
  type TeamModuleKey,
} from '@/lib/config/team-modules'

interface ModuleOption {
  key: TeamModuleKey
  section: ModuleSection
  label: string
  description: string
}

interface RolesShellProps {
  roles: RoleSummary[]
  modules: ModuleOption[]
}

interface EditorState {
  open: boolean
  role: RoleSummary | null /** null = create */
}

export function RolesShell({ roles: initialRoles, modules }: RolesShellProps) {
  const [roles, setRoles] = useState(initialRoles)
  const [editor, setEditor] = useState<EditorState>({ open: false, role: null })
  const [deleting, setDeleting] = useState<RoleSummary | null>(null)
  // Cell-level pending state so multiple in-flight toggles don't
  // step on each other visually. Keyed as `${roleId}:${moduleKey}`.
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  const openCreate = () => setEditor({ open: true, role: null })
  const openRename = (role: RoleSummary) => setEditor({ open: true, role })
  const close = () => setEditor({ open: false, role: null })

  // Bucket modules by section so we can render them as column
  // groups with per-section select-all controls.
  const sections = useMemo(() => {
    const bySection = new Map<ModuleSection, ModuleOption[]>()
    for (const section of MODULE_SECTIONS) bySection.set(section, [])
    for (const m of modules) {
      const list = bySection.get(m.section)
      if (list) list.push(m)
    }
    return MODULE_SECTIONS
      .map((section) => ({
        section,
        items: bySection.get(section) ?? [],
      }))
      .filter((s) => s.items.length > 0)
  }, [modules])

  const flatModules = useMemo(
    () => sections.flatMap((s) => s.items),
    [sections],
  )

  const requestDelete = (role: RoleSummary) => {
    // Canonical system roles (Admin, Internal Team) are permanent.
    // Legacy per-user shims are deletable once they hold no members.
    const isLegacy = role.slug.startsWith('legacy-')
    if (role.isSystem && !isLegacy) {
      toast.error('System roles cannot be deleted (rename them instead).')
      return
    }
    if (isLegacy && role.memberCount > 0) {
      toast.error(
        'Reassign this role’s members first — legacy roles can only be deleted when empty.',
      )
      return
    }
    setDeleting(role)
  }

  const confirmDelete = () => {
    const role = deleting
    if (!role) return
    startTransition(async () => {
      const res = await deleteRoleAction(role.id)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not delete role')
        setDeleting(null)
        return
      }
      setRoles((prev) => prev.filter((r) => r.id !== role.id))
      toast.success('Role deleted')
      setDeleting(null)
    })
  }

  /** Apply an arbitrary new permission set to a role and persist it.
   *  Optimistic; rolls back on server error. Used by both single-cell
   *  toggles and per-section bulk toggles. */
  const applyRoleUpdate = (role: RoleSummary, nextKeys: TeamModuleKey[], pendingCellIds: string[]) => {
    const previousKeys = role.moduleKeys
    setRoles((prev) =>
      prev.map((r) => (r.id === role.id ? { ...r, moduleKeys: nextKeys } : r)),
    )
    setSavingCells((prev) => {
      const next = new Set(prev)
      for (const id of pendingCellIds) next.add(id)
      return next
    })
    startTransition(async () => {
      const res = await updateRoleAction(role.id, { moduleKeys: nextKeys })
      setSavingCells((prev) => {
        const next = new Set(prev)
        for (const id of pendingCellIds) next.delete(id)
        return next
      })
      if (!res.ok) {
        setRoles((prev) =>
          prev.map((r) => (r.id === role.id ? { ...r, moduleKeys: previousKeys } : r)),
        )
        toast.error(res.error ?? 'Could not update role')
      }
    })
  }

  const toggleCell = (role: RoleSummary, moduleKey: TeamModuleKey) => {
    const has = role.moduleKeys.includes(moduleKey)
    const nextKeys = has
      ? role.moduleKeys.filter((k) => k !== moduleKey)
      : [...role.moduleKeys, moduleKey]
    applyRoleUpdate(role, nextKeys, [`${role.id}:${moduleKey}`])
  }

  const handleSaved = (saved: RoleSummary, wasCreate: boolean) => {
    if (wasCreate) {
      setRoles((prev) => [saved, ...prev])
    } else {
      setRoles((prev) => prev.map((r) => (r.id === saved.id ? saved : r)))
    }
    close()
  }

  const sortedRoles = useMemo(
    () =>
      [...roles].sort((a, b) => {
        if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1
        return a.name.localeCompare(b.name)
      }),
    [roles],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Roles</h1>
        <p className="text-muted-foreground">
          Define named permission bundles and assign them to team members.
          Toggle a checkbox to grant or revoke that role&apos;s access to a
          module — changes save instantly.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {roles.length} role{roles.length === 1 ? '' : 's'} · {flatModules.length}{' '}
          modules across {sections.length} sections
        </p>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New role
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            {/* Row 1 — section headers spanning their module columns */}
            <TableRow>
              <TableHead
                rowSpan={2}
                className="sticky left-0 z-10 min-w-56 bg-muted align-bottom"
              >
                Role
              </TableHead>
              {sections.map((s) => (
                <TableHead
                  key={s.section}
                  colSpan={s.items.length}
                  className="border-l bg-muted/60 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {s.section}
                </TableHead>
              ))}
              <TableHead rowSpan={2} className="align-bottom text-right">
                Members
              </TableHead>
              <TableHead rowSpan={2} className="w-24 align-bottom" />
            </TableRow>
            {/* Row 2 — one column per module (grouped visually by
                the border-l on the first item of each section) */}
            <TableRow>
              {sections.map((s) =>
                s.items.map((m, idx) => (
                  <TableHead
                    key={m.key}
                    className={cn(
                      'whitespace-nowrap text-center text-xs',
                      idx === 0 && 'border-l',
                    )}
                    title={m.description}
                  >
                    {m.label}
                  </TableHead>
                )),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRoles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={flatModules.length + 3}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No roles yet — create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              sortedRoles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="sticky left-0 z-10 bg-background">
                    <div className="flex items-start gap-2">
                      {role.isSystem ? (
                        <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ShieldPlus className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium">
                          <span className="truncate">{role.name}</span>
                          {role.isSystem ? (
                            <Badge variant="secondary" className="text-[10px]">
                              System
                            </Badge>
                          ) : null}
                        </div>
                        {role.description ? (
                          <div className="line-clamp-1 max-w-xs text-xs text-muted-foreground">
                            {role.description}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  {sections.map((s) =>
                    s.items.map((m, idx) => {
                      const cellId = `${role.id}:${m.key}`
                      const checked = role.moduleKeys.includes(m.key)
                      return (
                        <TableCell
                          key={m.key}
                          className={cn(
                            'p-0 text-center',
                            idx === 0 && 'border-l',
                            savingCells.has(cellId) && 'bg-primary/5',
                          )}
                        >
                          <label
                            className="mx-auto flex h-10 w-full cursor-pointer items-center justify-center"
                            aria-label={`${role.name} — ${m.label}`}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleCell(role, m.key)}
                            />
                          </label>
                        </TableCell>
                      )
                    }),
                  )}
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {role.memberCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openRename(role)}
                        aria-label="Rename role"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => requestDelete(role)}
                        disabled={
                          pending ||
                          // Canonical system roles are permanent.
                          // Legacy shims are deletable when empty.
                          (role.isSystem && !role.slug.startsWith('legacy-')) ||
                          (role.slug.startsWith('legacy-') &&
                            role.memberCount > 0)
                        }
                        aria-label="Delete role"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editor.open ? (
        <RoleEditor
          initial={editor.role}
          onSaved={(role) => handleSaved(role, !editor.role)}
          onCancel={close}
        />
      ) : null}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => (!o ? setDeleting(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete “{deleting?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && deleting.memberCount > 0
                ? `${deleting.memberCount} user${deleting.memberCount === 1 ? ' currently holds' : 's currently hold'} this role and will lose the modules it grants.`
                : 'This role has no members. The role definition will be permanently removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? 'Deleting…' : 'Delete role'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface RoleEditorProps {
  initial: RoleSummary | null
  onSaved: (role: RoleSummary) => void
  onCancel: () => void
}

// Small editor for name + description only — module toggles happen
// inline on the matrix. On create the new role starts with zero
// modules; the admin turns them on from the matrix immediately.
function RoleEditor({ initial, onSaved, onCancel }: RoleEditorProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [pending, startTransition] = useTransition()

  const isNew = !initial

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    startTransition(async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
      }
      const res = isNew
        ? await createRoleAction({ ...payload, moduleKeys: [] })
        : await updateRoleAction(initial!.id, payload)
      if (!res.ok) {
        toast.error(res.error ?? 'Could not save role')
        return
      }
      toast.success(isNew ? 'Role created' : 'Role updated')
      onSaved(res.data)
    })
  }

  return (
    <Dialog open onOpenChange={(o) => (!o ? onCancel() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? 'New role' : `Rename ${initial?.name}`}</DialogTitle>
          <DialogDescription>
            {isNew
              ? 'Give the role a name. Toggle its module access from the matrix once it appears.'
              : 'Rename the role and update its description.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Setter, Closer, Helper"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role-description">Description</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional — what this role is for."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? 'Saving…' : isNew ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
