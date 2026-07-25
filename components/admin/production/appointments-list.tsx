'use client'

import { useState, useTransition } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import {
  removeAppointment,
  saveAppointment,
  type AppointmentRow,
  type ProductionUserOption,
  type UpsertAppointmentInput,
} from '@/app/(admin)/admin/production-sheets/actions'

interface AppointmentsListProps {
  actorId: string
  targetUserId: string
  targetUserName: string
  users: ProductionUserOption[]
  currentUserIsAdmin: boolean
  appointments: AppointmentRow[]
  loading: boolean
  onChange: (rows: AppointmentRow[]) => void
}

const STATUSES = ['PENDING', 'SHOWED', 'NO_SHOW', 'CLOSED', 'LOST'] as const
type Status = (typeof STATUSES)[number]

const STATUS_VARIANT: Record<Status, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'secondary',
  SHOWED: 'outline',
  NO_SHOW: 'destructive',
  CLOSED: 'default',
  LOST: 'destructive',
}

const CURRENCY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

function formatMoney(n: number | null): string {
  return n === null || n === 0 ? '—' : CURRENCY.format(n)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface EditorState {
  open: boolean
  editing: AppointmentRow | null
}

export function AppointmentsList({
  targetUserId,
  targetUserName,
  users,
  currentUserIsAdmin,
  appointments,
  loading,
  onChange,
}: AppointmentsListProps) {
  const [editor, setEditor] = useState<EditorState>({ open: false, editing: null })

  const openCreate = () =>
    setEditor({
      open: true,
      editing: {
        id: '',
        setById: targetUserId,
        setByName: targetUserName,
        closerId: null,
        closerName: null,
        prospectName: '',
        prospectPhone: null,
        setAt: new Date().toISOString().slice(0, 10),
        appointmentAt: null,
        status: 'PENDING',
        revenueCollected: null,
        immediateAmount: null,
        monthlyPayment: null,
        funnel: null,
        notes: null,
      },
    })

  const openEdit = (row: AppointmentRow) =>
    setEditor({ open: true, editing: row })

  const close = () => setEditor({ open: false, editing: null })

  const handleSaved = (row: AppointmentRow, editingId: string) => {
    const exists = appointments.some((a) => a.id === editingId)
    const next = exists
      ? appointments.map((a) => (a.id === editingId ? row : a))
      : [row, ...appointments]
    onChange(next)
    close()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Appointment Log</h2>
          <p className="text-sm text-muted-foreground">
            Prospects booked + outcome + revenue collected.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Log Appointment
        </Button>
      </div>

      <div className={cn('rounded-lg border overflow-x-auto', loading && 'opacity-60')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prospect</TableHead>
              <TableHead>Set by</TableHead>
              <TableHead>Closer</TableHead>
              <TableHead>Set at</TableHead>
              <TableHead>Appointment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Immediate</TableHead>
              <TableHead className="text-right">Monthly</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-sm text-muted-foreground">
                  No appointments logged for this month yet.
                </TableCell>
              </TableRow>
            ) : (
              appointments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {a.prospectName}
                    {a.prospectPhone ? (
                      <div className="text-xs text-muted-foreground">{a.prospectPhone}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>{a.setByName}</TableCell>
                  <TableCell>{a.closerName ?? '—'}</TableCell>
                  <TableCell>{formatDate(a.setAt)}</TableCell>
                  <TableCell>{formatDate(a.appointmentAt)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[a.status as Status]}>
                      {a.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(a.revenueCollected)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(a.immediateAmount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(a.monthlyPayment)}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(a)}
                      aria-label="Edit appointment"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editor.open && editor.editing ? (
        <AppointmentEditor
          initial={editor.editing}
          users={users}
          currentUserIsAdmin={currentUserIsAdmin}
          targetUserId={targetUserId}
          onSaved={(row) => handleSaved(row, editor.editing!.id)}
          onDeleted={(id) => {
            onChange(appointments.filter((a) => a.id !== id))
            close()
          }}
          onCancel={close}
        />
      ) : null}
    </div>
  )
}

interface AppointmentEditorProps {
  initial: AppointmentRow
  users: ProductionUserOption[]
  currentUserIsAdmin: boolean
  targetUserId: string
  onSaved: (row: AppointmentRow) => void
  onDeleted: (id: string) => void
  onCancel: () => void
}

function AppointmentEditor({
  initial,
  users,
  currentUserIsAdmin,
  targetUserId,
  onSaved,
  onDeleted,
  onCancel,
}: AppointmentEditorProps) {
  const [form, setForm] = useState(initial)
  const [pending, startTransition] = useTransition()
  const isNew = !initial.id
  const isCurrentUserTheOnlyOption = users.length === 0

  const update = <K extends keyof AppointmentRow>(k: K, v: AppointmentRow[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  const handleSave = () => {
    if (!form.prospectName.trim()) {
      toast.error('Prospect name is required')
      return
    }
    const input: UpsertAppointmentInput = {
      id: isNew ? undefined : form.id,
      setById: currentUserIsAdmin ? form.setById : targetUserId,
      closerId: form.closerId ?? null,
      prospectName: form.prospectName.trim(),
      prospectPhone: form.prospectPhone?.trim() || null,
      setAt: form.setAt,
      appointmentAt: form.appointmentAt,
      status: form.status,
      revenueCollected: form.revenueCollected,
      immediateAmount: form.immediateAmount,
      monthlyPayment: form.monthlyPayment,
      funnel: form.funnel,
      notes: form.notes?.trim() || null,
    }
    startTransition(async () => {
      const result = await saveAppointment(input)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(isNew ? 'Appointment logged' : 'Appointment updated')
      onSaved(result.appointment)
    })
  }

  const handleDelete = () => {
    if (!form.id) return
    if (!confirm('Delete this appointment?')) return
    startTransition(async () => {
      const result = await removeAppointment(form.id, form.setById)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Appointment deleted')
      onDeleted(form.id)
    })
  }

  return (
    <Dialog open onOpenChange={(o) => (!o ? onCancel() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Log appointment' : 'Edit appointment'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <Label>Prospect name</Label>
            <Input
              value={form.prospectName}
              onChange={(e) => update('prospectName', e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label>Prospect phone</Label>
            <Input
              value={form.prospectPhone ?? ''}
              onChange={(e) => update('prospectPhone', e.target.value)}
              placeholder="(555) 555-5555"
            />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => v && update('status', v as Status)}
            >
              <SelectTrigger>
                <SelectValue>{(v: string) => v.replace('_', ' ')}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentUserIsAdmin && !isCurrentUserTheOnlyOption ? (
            <div className="space-y-1">
              <Label>Set by</Label>
              <Select
                value={form.setById}
                onValueChange={(v) => v && update('setById', v)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(v: string) => users.find((u) => u.id === v)?.name ?? 'Select'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label>Closer</Label>
            <Select
              value={form.closerId ?? '__none__'}
              onValueChange={(v) => update('closerId', v === '__none__' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue>
                  {(v: string) =>
                    v === '__none__'
                      ? 'Unassigned'
                      : users.find((u) => u.id === v)?.name ?? 'Unassigned'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Set date</Label>
            <Input
              type="date"
              value={form.setAt}
              onChange={(e) => update('setAt', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Appointment date/time</Label>
            <Input
              type="datetime-local"
              value={form.appointmentAt ? form.appointmentAt.slice(0, 16) : ''}
              onChange={(e) => update('appointmentAt', e.target.value ? new Date(e.target.value).toISOString() : null)}
            />
          </div>

          <div className="space-y-1">
            <Label>Revenue collected</Label>
            <Input
              type="number"
              step="0.01"
              value={form.revenueCollected ?? ''}
              onChange={(e) => update('revenueCollected', e.target.value === '' ? null : Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>Immediate</Label>
            <Input
              type="number"
              step="0.01"
              value={form.immediateAmount ?? ''}
              onChange={(e) => update('immediateAmount', e.target.value === '' ? null : Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>Monthly payment</Label>
            <Input
              type="number"
              step="0.01"
              value={form.monthlyPayment ?? ''}
              onChange={(e) => update('monthlyPayment', e.target.value === '' ? null : Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>Funnel</Label>
            <Select
              value={form.funnel === null ? '__none__' : form.funnel ? 'yes' : 'no'}
              onValueChange={(v) =>
                update('funnel', v === '__none__' ? null : v === 'yes')
              }
            >
              <SelectTrigger>
                <SelectValue>
                  {(v: string) => (v === '__none__' ? '—' : v === 'yes' ? 'Yes' : 'No')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1">
            <Label>Notes</Label>
            <Textarea
              value={form.notes ?? ''}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="justify-between">
          <div>
            {!isNew ? (
              <Button variant="destructive" onClick={handleDelete} disabled={pending}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={pending}>
              {pending ? 'Saving…' : isNew ? 'Log' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
