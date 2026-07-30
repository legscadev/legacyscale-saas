'use client'

// Table for /admin/crm/import/history. Rendered client-side only so
// the relative-time column stays fresh as the page ages — the shell
// hydrates once and lets the browser tick it.

import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

import { EmptyState } from '@/components/shared/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  ImportJobMode,
  ImportJobRow,
  ImportJobStatus,
} from '@/lib/services/crm-import-job-service'

const OBJECT_LABEL: Record<'CONTACTS' | 'OPPORTUNITIES', string> = {
  CONTACTS: 'Contacts',
  OPPORTUNITIES: 'Opportunities',
}

const MODE_LABEL: Record<ImportJobMode, string> = {
  CREATE_ONLY: 'Create only',
  CREATE_OR_UPDATE: 'Create + update',
  UPDATE_ONLY: 'Update only',
}

export function ImportHistoryTable({ jobs }: { jobs: ImportJobRow[] }) {
  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="No imports yet"
        description="Once you run an import through the wizard, its history will show up here."
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Object</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Created</TableHead>
            <TableHead className="text-right">Updated</TableHead>
            <TableHead className="text-right">Skipped</TableHead>
            <TableHead>File</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-medium">
                {OBJECT_LABEL[job.object]}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {MODE_LABEL[job.mode]}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {job.rowsTotal}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {job.rowsCreated}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {job.rowsUpdated}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {job.rowsSkipped}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                {job.fileName ?? '—'}
              </TableCell>
              <TableCell>
                <StatusPill status={job.status} error={job.errorMessage} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground tabular-nums">
                {relativeTime(job.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function StatusPill({
  status,
  error,
}: {
  status: ImportJobStatus
  error: string | null
}) {
  return (
    <span
      title={error ?? undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        status === 'COMPLETE' &&
          'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
        status === 'RUNNING' &&
          'border-blue-500/40 bg-blue-500/10 text-blue-600',
        status === 'FAILED' &&
          'border-destructive/40 bg-destructive/10 text-destructive',
      )}
    >
      {status === 'COMPLETE' ? (
        <CheckCircle2 className="size-3" />
      ) : status === 'RUNNING' ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <XCircle className="size-3" />
      )}
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}
