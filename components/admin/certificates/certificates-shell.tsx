'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Award,
  Ban,
  Download,
  Mail,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/shared'
import {
  downloadCertificateAction,
  emailCertificateAction,
  fetchCertificates,
  reinstateCertificateAction,
  type AdminCertificateRow,
} from '@/app/(admin)/admin/certificates/actions'
import { IssueCertificateDialog } from './issue-certificate-dialog'
import { RevokeCertificateDialog } from './revoke-certificate-dialog'
import type {
  CoursePickerOption,
  MemberPickerOption,
} from '@/app/(admin)/admin/certificates/actions'

type StatusFilter = 'all' | 'active' | 'revoked'

interface CertificatesShellProps {
  initialRows: AdminCertificateRow[]
  members: MemberPickerOption[]
  courses: CoursePickerOption[]
}

export function CertificatesShell({
  initialRows,
  members,
  courses,
}: CertificatesShellProps) {
  const [rows, setRows] = useState(initialRows)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [issueOpen, setIssueOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<AdminCertificateRow | null>(
    null,
  )
  const [refreshing, startRefresh] = useTransition()

  function refresh() {
    startRefresh(async () => {
      const next = await fetchCertificates({
        status,
        search: search.trim() || undefined,
      })
      setRows(next)
    })
  }

  const activeCount = useMemo(
    () => rows.filter((r) => !r.revokedAt).length,
    [rows],
  )
  const revokedCount = rows.length - activeCount

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificates"
        description="View, download, email, revoke or hand-issue member certificates."
      >
        <Button onClick={() => setIssueOpen(true)}>
          <Plus />
          Issue certificate
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total" value={rows.length} />
        <StatTile label="Active" value={activeCount} tone="success" />
        <StatTile label="Revoked" value={revokedCount} tone="warning" />
        <StatTile label="Manually issued" value={rows.filter((r) => r.manuallyIssued).length} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by member, module, course, cert #…"
            className="pl-9"
            onKeyDown={(e) => {
              if (e.key === 'Enter') refresh()
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            if (v) setStatus(v as StatusFilter)
          }}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={refresh} disabled={refreshing}>
          Apply
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Cert #</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  No certificates match those filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <CertRow
                  key={row.id}
                  row={row}
                  onChanged={refresh}
                  onRevoke={() => setRevokeTarget(row)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <IssueCertificateDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        members={members}
        courses={courses}
        onIssued={refresh}
      />
      <RevokeCertificateDialog
        target={revokeTarget}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
        onRevoked={refresh}
      />
    </div>
  )
}

interface StatTileProps {
  label: string
  value: number
  tone?: 'success' | 'warning'
}

function StatTile({ label, value, tone }: StatTileProps) {
  const toneCls =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-amber-600'
        : ''
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneCls}`}>
        {value}
      </div>
    </div>
  )
}

interface CertRowProps {
  row: AdminCertificateRow
  onRevoke: () => void
  onChanged: () => void
}

function CertRow({ row, onRevoke, onChanged }: CertRowProps) {
  const [pending, startTransition] = useTransition()

  function handleDownload() {
    startTransition(async () => {
      const result = await downloadCertificateAction(row.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      window.open(result.url, '_blank', 'noopener')
    })
  }

  function handleEmail() {
    startTransition(async () => {
      const result = await emailCertificateAction(row.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Emailed to ${row.member.email}`)
    })
  }

  function handleReinstate() {
    startTransition(async () => {
      const result = await reinstateCertificateAction(row.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Certificate reinstated')
      onChanged()
    })
  }

  const memberLabel = row.member.name?.trim() || row.member.email
  const isRevoked = row.revokedAt !== null

  return (
    <TableRow>
      <TableCell className="max-w-[200px]">
        <div className="truncate font-medium">{memberLabel}</div>
        {row.member.name ? (
          <div className="truncate text-xs text-muted-foreground">
            {row.member.email}
          </div>
        ) : null}
      </TableCell>
      <TableCell className="max-w-[220px] truncate">{row.module.title}</TableCell>
      <TableCell className="max-w-[220px] truncate text-muted-foreground">
        {row.course.title}
      </TableCell>
      <TableCell className="font-mono text-xs">{row.shortCode}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatDate(row.issuedAt)}
      </TableCell>
      <TableCell>
        <StatusBadge row={row} />
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Open actions"
            disabled={pending}
            render={
              <button
                type="button"
                className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownload} disabled={pending}>
              <Download className="size-4" />
              Download PDF
            </DropdownMenuItem>
            {!isRevoked ? (
              <DropdownMenuItem onClick={handleEmail} disabled={pending}>
                <Mail className="size-4" />
                Email to member
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            {isRevoked ? (
              <DropdownMenuItem onClick={handleReinstate} disabled={pending}>
                <RotateCcw className="size-4" />
                Reinstate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={onRevoke}
                disabled={pending}
                className="text-destructive focus:text-destructive"
              >
                <Ban className="size-4" />
                Revoke
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

function StatusBadge({ row }: { row: AdminCertificateRow }) {
  if (row.revokedAt) {
    return (
      <Badge variant="outline" className="border-destructive/40 text-destructive">
        Revoked
      </Badge>
    )
  }
  if (row.manuallyIssued) {
    return (
      <Badge variant="outline" className="border-info/40 text-info">
        Manual
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-success/40 text-success">
      <Award className="size-3" />
      Active
    </Badge>
  )
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}
