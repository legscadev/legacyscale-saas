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
  notes: string | null
}

interface ImportOpportunitiesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipelineId: string
  members: CrmTeamMember[]
  onImported: () => void
}

/**
 * RFC-4180-ish CSV parser that walks the whole document char-by-char
 * so quoted fields with embedded newlines survive. Records are split
 * only on newlines that occur *outside* a quoted field; each record
 * is then split on commas outside quotes. Doubled quotes inside a
 * quoted field ("") decode to a literal ".
 */
function parseCsvRecords(text: string): string[][] {
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      record.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      // \r\n → treat as one break; skip the \n after \r.
      if (ch === '\r' && text[i + 1] === '\n') i++
      record.push(field)
      field = ''
      if (record.length > 1 || record[0] !== '') records.push(record)
      record = []
    } else {
      field += ch
    }
  }
  // Trailing field / record without a final newline.
  if (field.length > 0 || record.length > 0) {
    record.push(field)
    if (record.length > 1 || record[0] !== '') records.push(record)
  }
  return records
}

const HEADER_ALIASES: Record<string, keyof CsvRow> = {
  // Deal name
  name: 'name',
  'deal name': 'name',
  deal: 'name',
  opportunity: 'name',
  'opportunity name': 'name',
  title: 'name',
  // Contact
  contact: 'contactName',
  'contact name': 'contactName',
  email: 'contactEmail',
  'contact email': 'contactEmail',
  phone: 'contactPhone',
  'contact phone': 'contactPhone',
  // Company
  company: 'companyName',
  'company name': 'companyName',
  organization: 'companyName',
  'business name': 'companyName',
  // Value — GHL uses "Lead Value".
  value: 'value',
  amount: 'value',
  price: 'value',
  'lead value': 'value',
  // Probability — GHL uses "Forecast Probability".
  probability: 'probability',
  prob: 'probability',
  'forecast probability': 'probability',
  // Stage
  stage: 'stageName',
  'stage name': 'stageName',
  // Notes — GHL exports a single free-text column that maps 1:1
  // onto our CrmOpportunity.notes field.
  notes: 'notes',
  note: 'notes',
  description: 'notes',
}

interface ParseResult {
  rows: CsvRow[]
  skipped: number
}

function parseCsv(text: string): ParseResult {
  const records = parseCsvRecords(text)
  if (records.length === 0) return { rows: [], skipped: 0 }

  const firstCells = records[0]!.map((c) => c.trim().toLowerCase())
  const hasHeader = firstCells.some((c) => c in HEADER_ALIASES)

  let columnMap: (keyof CsvRow | null)[]
  let dataRecords: string[][]
  if (hasHeader) {
    columnMap = firstCells.map((c) => HEADER_ALIASES[c] ?? null)
    dataRecords = records.slice(1)
  } else {
    // Positional fallback: name, contactName, contactEmail, value, stage.
    columnMap = ['name', 'contactName', 'contactEmail', 'value', 'stageName']
    dataRecords = records
  }

  const rows: CsvRow[] = []
  let skipped = 0
  for (const cells of dataRecords) {
    const row: Partial<Record<keyof CsvRow, string>> = {}
    columnMap.forEach((key, idx) => {
      if (!key) return
      const raw = cells[idx]
      if (raw === undefined) return
      // Notes may span multiple lines and lead/trail whitespace is
      // usually meaningful. For every other column trim aggressively.
      const val = key === 'notes' ? raw : raw.trim()
      if (val.length > 0) row[key] = val
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
      name: row.name.trim(),
      contactName: row.contactName ?? null,
      contactEmail: row.contactEmail ?? null,
      contactPhone: row.contactPhone ?? null,
      companyName: row.companyName ?? null,
      value: parseNumber(row.value),
      probability: parseNumber(row.probability),
      stageName: row.stageName ?? null,
      notes: row.notes ? row.notes.trim() || null : null,
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
              name (aka “opportunity name”), contact, email, phone,
              company, value (aka “lead value”), probability, stage,
              notes. GHL exports work as-is — extra columns like
              assigned / tags / IDs are silently ignored.
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
                  Assign all to (optional)
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
