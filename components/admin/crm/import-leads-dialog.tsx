'use client'

// CSV import dialog. Accepts a pasted CSV or an uploaded .csv file,
// parses it client-side, previews the row count + first few rows,
// then bulk-inserts via importLeadsAction (every row tagged
// CSV_IMPORT). Column mapping is by header name (case-insensitive)
// with sensible aliases; a headerless file falls back to positional
// name,email,phone,company order.

import { useRef, useState, useTransition } from 'react'
import { FileUp, Upload } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { importLeadsAction } from '@/app/(admin)/admin/crm/contacts/actions'
import type { CrmTeamMember } from '@/app/(admin)/admin/crm/contacts/actions'
import type { CsvLeadRow } from '@/lib/validations/crm-lead'

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface ImportLeadsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: CrmTeamMember[]
  onImported: () => void
}

/** Split one CSV line into fields, honouring double-quoted values
 *  (with "" escaping). Not a full RFC-4180 parser but handles the
 *  common cases: quoted commas + escaped quotes. */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

const HEADER_ALIASES: Record<string, keyof CsvLeadRow> = {
  name: 'fullName',
  'full name': 'fullName',
  fullname: 'fullName',
  'lead name': 'fullName',
  contact: 'fullName',
  email: 'email',
  'email address': 'email',
  phone: 'phone',
  'phone number': 'phone',
  mobile: 'phone',
  company: 'companyName',
  'company name': 'companyName',
  organization: 'companyName',
  industry: 'industry',
  campaign: 'campaign',
  source: 'campaign',
}

interface ParseResult {
  rows: CsvLeadRow[]
  skipped: number
}

function parseCsv(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return { rows: [], skipped: 0 }

  // Header detection: if the first line contains a known header token
  // and no '@', treat it as a header row.
  const firstCells = splitCsvLine(lines[0]!).map((c) => c.toLowerCase())
  const hasHeader =
    firstCells.some((c) => c in HEADER_ALIASES) &&
    !lines[0]!.includes('@')

  let columnMap: (keyof CsvLeadRow | null)[]
  let dataLines: string[]
  if (hasHeader) {
    columnMap = firstCells.map((c) => HEADER_ALIASES[c] ?? null)
    dataLines = lines.slice(1)
  } else {
    // Positional fallback: name, email, phone, company.
    columnMap = ['fullName', 'email', 'phone', 'companyName']
    dataLines = lines
  }

  const rows: CsvLeadRow[] = []
  let skipped = 0
  for (const line of dataLines) {
    const cells = splitCsvLine(line)
    const row: Partial<CsvLeadRow> = {}
    columnMap.forEach((key, idx) => {
      if (!key) return
      const val = cells[idx]?.trim()
      if (val) (row as Record<string, string>)[key] = val
    })
    if (!row.fullName) {
      skipped++
      continue
    }
    rows.push({
      fullName: row.fullName,
      email: row.email ?? null,
      phone: row.phone ?? null,
      companyName: row.companyName ?? null,
      industry: row.industry ?? null,
      campaign: row.campaign ?? null,
    })
  }
  return { rows, skipped }
}

export function ImportLeadsDialog({
  open,
  onOpenChange,
  members,
  onImported,
}: ImportLeadsDialogProps) {
  const [pending, startTransition] = useTransition()
  const [text, setText] = useState('')
  const [assignedSetterId, setAssignedSetterId] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = text.trim() ? parseCsv(text) : { rows: [], skipped: 0 }

  function reset() {
    setText('')
    setAssignedSetterId('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const content = await file.text()
    setText(content)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (parsed.rows.length === 0) {
      toast.error('No valid rows found — need at least a name column')
      return
    }
    startTransition(async () => {
      const res = await importLeadsAction({
        rows: parsed.rows,
        assignedSetterId: assignedSetterId || null,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not import leads')
        return
      }
      toast.success(`Imported ${res.data.created} lead${res.data.created === 1 ? '' : 's'}`)
      onImported()
      handleOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Import leads from CSV</DialogTitle>
            <DialogDescription>
              Paste CSV or upload a .csv file. Recognised columns: name,
              email, phone, company, industry, campaign. A name column is
              required.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <FileUp className="size-4" />
                Choose .csv
              </Button>
              <span className="text-xs text-muted-foreground">or paste below</span>
            </div>

            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'name,email,phone,company\nJane Doe,jane@acme.com,+15550100,Acme Corp'}
              rows={7}
              className="font-mono text-xs"
            />

            {text.trim() ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <p className="font-medium">
                  {parsed.rows.length} row{parsed.rows.length === 1 ? '' : 's'} ready
                  {parsed.skipped > 0 ? (
                    <span className="text-muted-foreground">
                      {' '}
                      · {parsed.skipped} skipped (no name)
                    </span>
                  ) : null}
                </p>
                {parsed.rows.slice(0, 3).map((r, i) => (
                  <p key={i} className="truncate text-muted-foreground">
                    {r.fullName}
                    {r.email ? ` · ${r.email}` : ''}
                    {r.companyName ? ` · ${r.companyName}` : ''}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="grid gap-1.5">
              <Label htmlFor="import-setter">Assign all to setter</Label>
              <select
                id="import-setter"
                value={assignedSetterId}
                onChange={(e) => setAssignedSetterId(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || parsed.rows.length === 0}>
              <Upload className="size-4" />
              {pending ? 'Importing…' : `Import ${parsed.rows.length || ''}`.trim()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
