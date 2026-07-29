'use client'

// CSV import for opportunities. Mirrors ImportLeadsDialog: accepts a
// pasted CSV or an uploaded .csv, parses client-side, previews
// row/skip counts, then hands off to importOpportunitiesAction which
// resolves each row's stage name against the target pipeline.

import { useRef, useState, useTransition } from 'react'
import { Upload } from 'lucide-react'
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

import { importOpportunitiesAction } from '@/app/(admin)/admin/crm/opportunities/actions'
import type { CrmTeamMember } from '@/app/(admin)/admin/crm/opportunities/actions'

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

interface CsvRow {
  name: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  companyName: string | null
  value: number | null
  probability: number | null
  stageName: string | null
}

interface ImportOpportunitiesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipelineId: string
  members: CrmTeamMember[]
  onImported: () => void
}

/** Same tolerant one-line CSV splitter used by the lead importer —
 *  handles quoted commas + escaped double-quotes. Not RFC-4180 strict
 *  but good enough for hand-rolled spreadsheets. */
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

const HEADER_ALIASES: Record<string, keyof CsvRow> = {
  name: 'name',
  'deal name': 'name',
  deal: 'name',
  opportunity: 'name',
  contact: 'contactName',
  'contact name': 'contactName',
  email: 'contactEmail',
  'contact email': 'contactEmail',
  phone: 'contactPhone',
  'contact phone': 'contactPhone',
  company: 'companyName',
  'company name': 'companyName',
  organization: 'companyName',
  value: 'value',
  amount: 'value',
  price: 'value',
  probability: 'probability',
  prob: 'probability',
  stage: 'stageName',
  'stage name': 'stageName',
}

interface ParseResult {
  rows: CsvRow[]
  skipped: number
}

function parseCsv(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return { rows: [], skipped: 0 }

  const firstCells = splitCsvLine(lines[0]!).map((c) => c.toLowerCase())
  const hasHeader = firstCells.some((c) => c in HEADER_ALIASES)

  let columnMap: (keyof CsvRow | null)[]
  let dataLines: string[]
  if (hasHeader) {
    columnMap = firstCells.map((c) => HEADER_ALIASES[c] ?? null)
    dataLines = lines.slice(1)
  } else {
    // Positional fallback: name, contactName, contactEmail, value, stage.
    columnMap = ['name', 'contactName', 'contactEmail', 'value', 'stageName']
    dataLines = lines
  }

  const rows: CsvRow[] = []
  let skipped = 0
  for (const line of dataLines) {
    const cells = splitCsvLine(line)
    const row: Partial<Record<keyof CsvRow, string>> = {}
    columnMap.forEach((key, idx) => {
      if (!key) return
      const val = cells[idx]?.trim()
      if (val) row[key] = val
    })
    if (!row.name) {
      skipped++
      continue
    }
    const parseNumber = (v: string | undefined): number | null => {
      if (!v) return null
      const cleaned = v.replace(/[^0-9.\-]/g, '')
      if (!cleaned) return null
      const n = Number(cleaned)
      return Number.isFinite(n) ? n : null
    }
    rows.push({
      name: row.name,
      contactName: row.contactName ?? null,
      contactEmail: row.contactEmail ?? null,
      contactPhone: row.contactPhone ?? null,
      companyName: row.companyName ?? null,
      value: parseNumber(row.value),
      probability: parseNumber(row.probability),
      stageName: row.stageName ?? null,
    })
  }
  return { rows, skipped }
}

export function ImportOpportunitiesDialog({
  open,
  onOpenChange,
  pipelineId,
  members,
  onImported,
}: ImportOpportunitiesDialogProps) {
  const [pending, startTransition] = useTransition()
  const [text, setText] = useState('')
  const [assignedCloserId, setAssignedCloserId] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = text.trim() ? parseCsv(text) : { rows: [], skipped: 0 }

  function reset() {
    setText('')
    setAssignedCloserId('')
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
      const res = await importOpportunitiesAction({
        pipelineId,
        rows: parsed.rows,
        assignedCloserId: assignedCloserId || null,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Could not import opportunities')
        return
      }
      const { created, skipped } = res.data
      if (skipped === 0) {
        toast.success(
          `Imported ${created} deal${created === 1 ? '' : 's'}`,
        )
      } else {
        toast.warning(
          `Imported ${created} deals — ${skipped} row${skipped === 1 ? '' : 's'} skipped`,
        )
      }
      onImported()
      handleOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Import opportunities</DialogTitle>
            <DialogDescription>
              Paste CSV or upload a .csv file. Recognised columns:
              name, contact, email, phone, company, value, probability,
              stage. First column with any known header is treated as
              the header row.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-between gap-2">
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
                <Upload className="size-4" />
                Choose .csv
              </Button>
              {parsed.rows.length > 0 || parsed.skipped > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {parsed.rows.length} row
                  {parsed.rows.length === 1 ? '' : 's'} ready
                  {parsed.skipped > 0 ? (
                    <span className="ml-1 text-amber-600">
                      · {parsed.skipped} skipped (missing name)
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="opp-import-text">CSV content</Label>
              <Textarea
                id="opp-import-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder="name,contact,email,value,stage
Acme upgrade,Jane Doe,jane@acme.com,25000,Proposal Sent
Beta pilot,Bob Smith,bob@beta.co,5000,Contacted"
                className="font-mono text-xs"
              />
            </div>

            {members.length > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="opp-import-assign">
                  Assign all to closer (optional)
                </Label>
                <select
                  id="opp-import-assign"
                  value={assignedCloserId}
                  onChange={(e) => setAssignedCloserId(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">— Leave unassigned —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name ?? m.email}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
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
            <Button
              type="submit"
              disabled={pending || parsed.rows.length === 0}
            >
              {pending ? 'Importing…' : `Import ${parsed.rows.length} deal${parsed.rows.length === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
