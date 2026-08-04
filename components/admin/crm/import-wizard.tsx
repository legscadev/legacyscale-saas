'use client'

// GHL-style import wizard. Four steps in a single client component:
//   1. Start   — pick which object to import.
//   2. Upload  — drag/drop a CSV; sample-file download; size cap.
//   3. Map     — auto-detect columns from headers, let user override.
//   4. Verify  — preview counts + errors, then commit through the
//                existing importLeadsAction / importOpportunitiesAction.
//
// Kept in one file even though it's large — the state machine is
// tight enough that splitting would require passing dozens of props
// between step components. `renderStep` fans out to per-step
// renderers so each step's markup stays localised.

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileSpreadsheet,
  History,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { importLeadsAction } from '@/app/(admin)/admin/crm/contacts/actions'
import { importOpportunitiesAction } from '@/app/(admin)/admin/crm/opportunities/actions'
import type { CrmTeamMember } from '@/app/(admin)/admin/crm/opportunities/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { PipelineSummary } from '@/lib/services/crm-pipeline-service'
import {
  csvLeadRowSchema,
  type CsvLeadRow,
} from '@/lib/validations/crm-lead'
import {
  csvOpportunitySchema,
  type CsvOpportunityRow,
} from '@/lib/validations/crm'

// ============================================
// TYPES
// ============================================

type ObjectId = 'contacts' | 'opportunities'
type StepId = 'start' | 'upload' | 'map' | 'verify'

/** How the wizard treats a CSV row that matches an existing record.
 *  Value strings match the shared importModeSchema enum. */
type ImportMode = 'CREATE_ONLY' | 'CREATE_OR_UPDATE' | 'UPDATE_ONLY'

const IMPORT_MODE_LABELS: Record<ImportMode, string> = {
  CREATE_ONLY: 'Create new only',
  CREATE_OR_UPDATE: 'Create new and update existing',
  UPDATE_ONLY: 'Update existing only',
}

const IMPORT_MODE_DESCRIPTIONS: Record<ImportMode, string> = {
  CREATE_ONLY: 'Insert every row as a new record.',
  CREATE_OR_UPDATE:
    'Match by email. If found, update in place — otherwise create a new record.',
  UPDATE_ONLY:
    'Match by email. If found, update in place. Rows without a match are skipped.',
}

/** Per-request row cap enforced by the server (importLeadsSchema /
 *  importOpportunitiesSchema). Kept in sync here so the wizard can
 *  block oversized batches at Verify instead of failing on submit. */
const MAX_ROWS_PER_IMPORT = 2000

/** All target fields the mapper can pick, per object. `null` = skip. */
type ContactField =
  | 'fullName'
  | 'email'
  | 'phone'
  | 'companyName'
  | 'industry'
  | 'campaign'

type OpportunityField =
  | 'name'
  | 'contactName'
  | 'contactEmail'
  | 'contactPhone'
  | 'companyName'
  | 'value'
  | 'probability'
  | 'stageName'
  | 'notes'

type TargetField = ContactField | OpportunityField

interface FieldSpec<T extends TargetField> {
  id: T
  label: string
  required?: boolean
  /** Headers (lowercased) that map to this field. */
  aliases: string[]
}

const CONTACT_FIELDS: FieldSpec<ContactField>[] = [
  {
    id: 'fullName',
    label: 'Full name',
    required: true,
    aliases: [
      'name',
      'full name',
      'fullname',
      'lead name',
      'contact',
      'contact name',
    ],
  },
  {
    id: 'email',
    label: 'Email',
    aliases: ['email', 'email address', 'contact email'],
  },
  {
    id: 'phone',
    label: 'Phone',
    aliases: ['phone', 'phone number', 'mobile', 'contact phone'],
  },
  {
    id: 'companyName',
    label: 'Company',
    aliases: ['company', 'company name', 'organization', 'business name'],
  },
  { id: 'industry', label: 'Industry', aliases: ['industry'] },
  { id: 'campaign', label: 'Campaign', aliases: ['campaign', 'source'] },
]

const OPPORTUNITY_FIELDS: FieldSpec<OpportunityField>[] = [
  {
    id: 'name',
    label: 'Opportunity name',
    required: true,
    aliases: [
      'name',
      'deal name',
      'deal',
      'opportunity',
      'opportunity name',
      'title',
    ],
  },
  {
    id: 'contactName',
    label: 'Contact name',
    aliases: ['contact', 'contact name'],
  },
  { id: 'contactEmail', label: 'Contact email', aliases: ['email', 'contact email'] },
  { id: 'contactPhone', label: 'Contact phone', aliases: ['phone', 'contact phone'] },
  {
    id: 'companyName',
    label: 'Company',
    aliases: ['company', 'company name', 'organization', 'business name'],
  },
  {
    id: 'value',
    label: 'Value',
    aliases: ['value', 'amount', 'price', 'lead value'],
  },
  {
    id: 'probability',
    label: 'Probability (%)',
    aliases: ['probability', 'prob', 'forecast probability'],
  },
  { id: 'stageName', label: 'Stage', aliases: ['stage', 'stage name'] },
  { id: 'notes', label: 'Notes', aliases: ['notes', 'note', 'description'] },
]

// ============================================
// COMPONENT
// ============================================

interface Props {
  preselectedObject: ObjectId
  pipelines: PipelineSummary[]
  contactMembers: CrmTeamMember[]
  opportunityMembers: CrmTeamMember[]
}

export function ImportWizard({
  preselectedObject,
  pipelines,
  contactMembers,
  opportunityMembers,
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState<StepId>('start')
  const [object, setObject] = useState<ObjectId>(preselectedObject)
  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Array<TargetField | null>>([])
  const [mode, setMode] = useState<ImportMode>('CREATE_ONLY')
  const [pipelineId, setPipelineId] = useState<string>('')
  const [assigneeId, setAssigneeId] = useState<string>('')
  const [pending, startTransition] = useTransition()

  const members =
    object === 'contacts' ? contactMembers : opportunityMembers

  const steps: Array<{ id: StepId; title: string; description: string }> = [
    {
      id: 'start',
      title: 'Start',
      description: 'Select what to import',
    },
    {
      id: 'upload',
      title: 'Upload',
      description: 'Upload your file',
    },
    { id: 'map', title: 'Map', description: 'Match columns to fields' },
    {
      id: 'verify',
      title: 'Verify',
      description: 'Review and confirm',
    },
  ]
  const currentStepIndex = steps.findIndex((s) => s.id === step)

  function goNext() {
    const next = steps[currentStepIndex + 1]
    if (next) setStep(next.id)
  }
  function goBack() {
    const prev = steps[currentStepIndex - 1]
    if (prev) setStep(prev.id)
  }

  function handleFileParsed(
    picked: File,
    headers: string[],
    rows: string[][],
  ) {
    setFile(picked)
    setCsvHeaders(headers)
    setCsvRows(rows)
    // Auto-map each CSV column via the object's alias table.
    const fields =
      object === 'contacts'
        ? (CONTACT_FIELDS as FieldSpec<TargetField>[])
        : (OPPORTUNITY_FIELDS as FieldSpec<TargetField>[])
    const nextMap = headers.map((h) => {
      const norm = h.trim().toLowerCase()
      const match = fields.find((f) => f.aliases.includes(norm))
      return match?.id ?? null
    })
    setMapping(nextMap)
    goNext()
  }

  const parsedResult = useMemo(
    () => (step === 'verify' ? parseRows(object, csvHeaders, csvRows, mapping) : null),
    [step, object, csvHeaders, csvRows, mapping],
  )

  function handleSubmit() {
    if (!parsedResult) return
    if (parsedResult.rows.length === 0) {
      toast.error('Nothing to import — every row failed validation')
      return
    }
    if (parsedResult.rows.length > MAX_ROWS_PER_IMPORT) {
      toast.error(
        `Too many rows (${parsedResult.rows.length.toLocaleString()}). Split the file into chunks of ${MAX_ROWS_PER_IMPORT.toLocaleString()} and import each one.`,
      )
      return
    }

    startTransition(async () => {
      if (object === 'contacts') {
        const res = await importLeadsAction({
          rows: parsedResult.rows as CsvLeadRow[],
          assignedSetterId: assigneeId || null,
          mode,
          fileName: file?.name,
          fileSize: file?.size,
        })
        if (!res.ok) {
          toast.error(res.error ?? 'Import failed')
          return
        }
        toast.success(
          `Imported ${res.data.created} new · ${res.data.updated} updated`,
        )
        router.push('/admin/crm/contacts')
        return
      }

      if (!pipelineId) {
        toast.error('Pick a pipeline before importing opportunities')
        return
      }
      const res = await importOpportunitiesAction({
        pipelineId,
        rows: parsedResult.rows as CsvOpportunityRow[],
        assignedCloserId: assigneeId || null,
        mode,
        fileName: file?.name,
        fileSize: file?.size,
      })
      if (!res.ok) {
        toast.error(res.error ?? 'Import failed')
        return
      }
      toast.success(
        `Imported ${res.data.created} new · ${res.data.updated} updated`,
      )
      router.push('/admin/crm/opportunities')
    })
  }

  // A required field that's missing from the mapping blocks progress
  // from Map → Verify. Compute here so both Map (row rendering) and
  // the footer button state can share it.
  const missingRequired = useMemo(() => {
    const required =
      object === 'contacts'
        ? CONTACT_FIELDS.filter((f) => f.required).map((f) => f.id)
        : OPPORTUNITY_FIELDS.filter((f) => f.required).map((f) => f.id)
    return required.filter((r) => !mapping.includes(r as TargetField))
  }, [mapping, object])

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Imports</h1>
          <p className="text-sm text-muted-foreground">
            Import contacts and opportunities from a CSV.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.push('/admin/crm/import/history')}
        >
          <History className="size-3.5" />
          Previous imports
        </Button>
      </header>

      <Stepper steps={steps} activeIndex={currentStepIndex} />

      <div className="rounded-lg border bg-card p-6">
        {step === 'start' ? (
          <StartStep object={object} onChange={setObject} />
        ) : step === 'upload' ? (
          <UploadStep
            object={object}
            file={file}
            mode={mode}
            onModeChange={setMode}
            onFileParsed={handleFileParsed}
            onClear={() => {
              setFile(null)
              setCsvHeaders([])
              setCsvRows([])
              setMapping([])
            }}
          />
        ) : step === 'map' ? (
          <MapStep
            object={object}
            headers={csvHeaders}
            mapping={mapping}
            missingRequired={missingRequired}
            onChangeMapping={setMapping}
          />
        ) : (
          <VerifyStep
            object={object}
            parsed={parsedResult}
            pipelines={pipelines}
            members={members}
            pipelineId={pipelineId}
            onPipelineChange={setPipelineId}
            assigneeId={assigneeId}
            onAssigneeChange={setAssigneeId}
          />
        )}
      </div>

      <footer className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <div className="flex gap-2">
          {step !== 'start' ? (
            <Button variant="outline" onClick={goBack} disabled={pending}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : null}
          {step === 'verify' ? (
            <Button
              onClick={handleSubmit}
              disabled={
                pending ||
                !parsedResult ||
                parsedResult.rows.length === 0 ||
                parsedResult.rows.length > MAX_ROWS_PER_IMPORT ||
                (object === 'opportunities' && !pipelineId)
              }
            >
              {pending ? 'Importing…' : `Import ${parsedResult?.rows.length ?? 0}`}
            </Button>
          ) : (
            <Button
              onClick={goNext}
              disabled={
                pending ||
                (step === 'upload' && !file) ||
                (step === 'map' && missingRequired.length > 0)
              }
            >
              Next
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}

// ============================================
// STEPPER
// ============================================

function Stepper({
  steps,
  activeIndex,
}: {
  steps: Array<{ id: StepId; title: string; description: string }>
  activeIndex: number
}) {
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((s, i) => {
        const state =
          i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'todo'
        return (
          <li key={s.id} className="flex flex-1 items-center gap-3 min-w-[160px]">
            <div
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                state === 'done'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : state === 'active'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input text-muted-foreground',
              )}
            >
              {state === 'done' ? <Check className="size-4" /> : i + 1}
            </div>
            <div className="min-w-0">
              <p
                className={cn(
                  'text-sm font-medium',
                  state === 'todo' && 'text-muted-foreground',
                )}
              >
                {s.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {s.description}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ============================================
// STEP 1 — START
// ============================================

function StartStep({
  object,
  onChange,
}: {
  object: ObjectId
  onChange: (next: ObjectId) => void
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Select objects to import</h2>
        <p className="text-sm text-muted-foreground">
          Pick what the file contains. The next step will accept either a
          contacts or an opportunities export.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ObjectCard
          id="contacts"
          active={object === 'contacts'}
          onClick={() => onChange('contacts')}
          icon={Users}
          title="Contacts"
          description="Contact records and their details."
        />
        <ObjectCard
          id="opportunities"
          active={object === 'opportunities'}
          onClick={() => onChange('opportunities')}
          icon={FileSpreadsheet}
          title="Opportunities"
          description="Deals, their stages, statuses, and pipeline progress."
        />
      </div>
    </section>
  )
}

function ObjectCard({
  active,
  onClick,
  icon: Icon,
  title,
  description,
}: {
  id: ObjectId
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
        active
          ? 'border-primary bg-primary/5'
          : 'border-input hover:border-primary/40 hover:bg-accent/40',
      )}
    >
      <Icon
        className={cn(
          'size-6 shrink-0',
          active ? 'text-primary' : 'text-muted-foreground',
        )}
      />
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}

// ============================================
// STEP 2 — UPLOAD
// ============================================

function UploadStep({
  object,
  file,
  mode,
  onModeChange,
  onFileParsed,
  onClear,
}: {
  object: ObjectId
  file: File | null
  mode: ImportMode
  onModeChange: (m: ImportMode) => void
  onFileParsed: (file: File, headers: string[], rows: string[][]) => void
  onClear: () => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const MAX_MB = 10

  async function handleFile(picked: File) {
    if (picked.size > MAX_MB * 1024 * 1024) {
      toast.error(`File is over ${MAX_MB}MB`)
      return
    }
    const text = await picked.text()
    const records = parseCsv(text)
    if (records.length === 0) {
      toast.error('CSV appears empty')
      return
    }
    const headers = (records[0] ?? []).map((h) => h.trim())
    const dataRows = records.slice(1).filter((r) => r.some((c) => c.trim()))
    if (dataRows.length === 0) {
      toast.error('No data rows found (only a header line)')
      return
    }
    onFileParsed(picked, headers, dataRows)
  }

  function downloadSample() {
    const filename =
      object === 'contacts'
        ? 'kondense-contacts-sample.csv'
        : 'kondense-opportunities-sample.csv'
    const csv =
      object === 'contacts'
        ? [
            'Full Name,Email,Phone,Company,Industry,Campaign',
            'Jane Doe,jane@acme.com,+15550100,Acme Corp,SaaS,Q3 outbound',
            'John Smith,john@beta.co,+15550110,Beta Inc,Fintech,Google Ads',
          ].join('\n')
        : [
            'Opportunity Name,Contact Name,Contact Email,Contact Phone,Company,Value,Probability,Stage,Notes',
            'Website redesign,Jane Doe,jane@acme.com,+15550100,Acme Corp,5000,40,Qualified,Kickoff scheduled',
            'SEO retainer,John Smith,john@beta.co,+15550110,Beta Inc,2000,60,Contacted,Sent proposal',
          ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Upload your file</h2>
          <p className="text-sm text-muted-foreground">
            Before uploading, make sure your file is ready to import. Max{' '}
            {MAX_MB}MB.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadSample}>
          <Download className="size-3.5" />
          Download sample
        </Button>
      </div>

      {file ? (
        <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="size-4" />
            Remove
          </Button>
        </div>
      ) : (
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const dropped = e.dataTransfer.files[0]
            if (dropped) handleFile(dropped)
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-12 text-center transition-colors',
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-input hover:border-primary/40 hover:bg-accent/20',
          )}
        >
          <Upload className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">Click to upload or drag and drop</p>
          <p className="text-xs text-muted-foreground">CSV (max {MAX_MB}MB)</p>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0]
              if (picked) handleFile(picked)
              e.target.value = ''
            }}
          />
        </label>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="import-mode" className="text-xs">
          How to import {object}
        </Label>
        <select
          id="import-mode"
          value={mode}
          onChange={(e) => onModeChange(e.target.value as ImportMode)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
        >
          {(
            ['CREATE_ONLY', 'CREATE_OR_UPDATE', 'UPDATE_ONLY'] as ImportMode[]
          ).map((m) => (
            <option key={m} value={m}>
              {IMPORT_MODE_LABELS[m]}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {IMPORT_MODE_DESCRIPTIONS[mode]}
        </p>
      </div>
    </section>
  )
}

// ============================================
// STEP 3 — MAP
// ============================================

function MapStep({
  object,
  headers,
  mapping,
  missingRequired,
  onChangeMapping,
}: {
  object: ObjectId
  headers: string[]
  mapping: Array<TargetField | null>
  missingRequired: TargetField[]
  onChangeMapping: (next: Array<TargetField | null>) => void
}) {
  const fields =
    object === 'contacts'
      ? (CONTACT_FIELDS as FieldSpec<TargetField>[])
      : (OPPORTUNITY_FIELDS as FieldSpec<TargetField>[])
  const takenFields = new Set(mapping.filter((m): m is TargetField => !!m))

  function setColumnMapping(idx: number, next: TargetField | null) {
    const copy = [...mapping]
    copy[idx] = next
    onChangeMapping(copy)
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Match columns to fields</h2>
        <p className="text-sm text-muted-foreground">
          Auto-matched from your headers. Override any row or set to Skip.
        </p>
      </div>

      {missingRequired.length > 0 ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          Required field
          {missingRequired.length === 1 ? '' : 's'} not mapped:{' '}
          <b>
            {missingRequired
              .map((r) => fields.find((f) => f.id === r)?.label ?? r)
              .join(', ')}
          </b>
        </p>
      ) : null}

      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-1/2 px-3 py-2 font-medium">CSV column</th>
              <th className="w-1/2 px-3 py-2 font-medium">Target field</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {headers.map((header, i) => {
              const current = mapping[i] ?? null
              return (
                <tr key={`${header}-${i}`}>
                  <td className="px-3 py-2 font-medium">{header || '—'}</td>
                  <td className="px-3 py-2">
                    <select
                      value={current ?? ''}
                      onChange={(e) =>
                        setColumnMapping(
                          i,
                          e.target.value
                            ? (e.target.value as TargetField)
                            : null,
                        )
                      }
                      className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm"
                    >
                      <option value="">Skip this column</option>
                      {fields.map((f) => {
                        const takenElsewhere =
                          takenFields.has(f.id) && current !== f.id
                        return (
                          <option
                            key={f.id}
                            value={f.id}
                            disabled={takenElsewhere}
                          >
                            {f.label}
                            {f.required ? ' *' : ''}
                            {takenElsewhere ? ' (already mapped)' : ''}
                          </option>
                        )
                      })}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ============================================
// STEP 4 — VERIFY
// ============================================

interface ParseResult {
  rows: Array<Record<string, unknown>>
  errors: Array<{ row: number; message: string }>
  totalScanned: number
}

function VerifyStep({
  object,
  parsed,
  pipelines,
  members,
  pipelineId,
  onPipelineChange,
  assigneeId,
  onAssigneeChange,
}: {
  object: ObjectId
  parsed: ParseResult | null
  pipelines: PipelineSummary[]
  members: CrmTeamMember[]
  pipelineId: string
  onPipelineChange: (v: string) => void
  assigneeId: string
  onAssigneeChange: (v: string) => void
}) {
  const preview = parsed?.rows.slice(0, 10) ?? []
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Review and confirm</h2>
        <p className="text-sm text-muted-foreground">
          Ready to import <b>{parsed?.rows.length ?? 0}</b> row
          {parsed?.rows.length === 1 ? '' : 's'} out of{' '}
          {parsed?.totalScanned ?? 0} scanned.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {object === 'opportunities' ? (
          <div className="grid gap-1.5">
            <Label htmlFor="import-pipeline" className="text-xs">
              Target pipeline *
            </Label>
            <select
              id="import-pipeline"
              value={pipelineId}
              onChange={(e) => onPipelineChange(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
            >
              <option value="">Pick a pipeline…</option>
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor="import-assignee" className="text-xs">
            Default assignee
          </Label>
          <select
            id="import-assignee"
            value={assigneeId}
            onChange={(e) => onAssigneeChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
            disabled={members.length === 0}
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.email.split('@')[0]}
              </option>
            ))}
          </select>
          {members.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No admins or users with a Setter/Closer role yet. Assign
              a role in /admin/team, or leave imports Unassigned.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Admins and users with a Setter or Closer role are eligible.
            </p>
          )}
        </div>
      </div>

      {parsed && parsed.rows.length > MAX_ROWS_PER_IMPORT ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-xs">
          <p className="font-medium text-destructive">
            Too many rows in this file
          </p>
          <p className="mt-1 text-destructive/90">
            {parsed.rows.length.toLocaleString()} valid rows detected —
            the per-import cap is {MAX_ROWS_PER_IMPORT.toLocaleString()}.
            Split the CSV into chunks of{' '}
            {MAX_ROWS_PER_IMPORT.toLocaleString()} or fewer and import
            each one; results merge under the same list.
          </p>
        </div>
      ) : null}

      {parsed && parsed.errors.length > 0 ? (
        <details className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <summary className="cursor-pointer text-xs font-medium text-amber-700">
            {parsed.errors.length} row
            {parsed.errors.length === 1 ? '' : 's'} skipped due to
            validation
          </summary>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
            {parsed.errors.slice(0, 50).map((e, i) => (
              <li key={i} className="tabular-nums">
                Row {e.row + 2}: {e.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {preview.length > 0 ? (
        <div className="overflow-hidden rounded-md border">
          <p className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
            First {preview.length} row{preview.length === 1 ? '' : 's'}
          </p>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/20 text-left">
                <tr>
                  {Object.keys(preview[0] ?? {}).map((k) => (
                    <th key={k} className="px-3 py-2 font-medium">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.map((row, i) => (
                  <tr key={i}>
                    {Object.entries(row).map(([k, v]) => (
                      <td key={k} className="px-3 py-1.5 tabular-nums">
                        {v === null || v === undefined ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          String(v)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  )
}

// ============================================
// PARSING HELPERS
// ============================================

/** RFC-4180-ish CSV parser: handles quoted fields with embedded
 *  commas and doubled quotes. Same shape as the one in the legacy
 *  import dialog so behavior is identical. */
function parseCsv(text: string): string[][] {
  const out: string[][] = []
  let cur: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      cur.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      cur.push(cell)
      out.push(cur)
      cur = []
      cell = ''
    } else {
      cell += c
    }
  }
  if (cell.length > 0 || cur.length > 0) {
    cur.push(cell)
    out.push(cur)
  }
  return out.filter((r) => r.length > 0 && r.some((c) => c.length > 0))
}

/** Apply the user-picked column mapping to every data row, then
 *  Zod-validate. Rejected rows go to `errors` with a 1-based row
 *  number for user-facing display. */
function parseRows(
  object: ObjectId,
  headers: string[],
  rows: string[][],
  mapping: Array<TargetField | null>,
): ParseResult {
  const out: ParseResult = { rows: [], errors: [], totalScanned: rows.length }
  const schema =
    object === 'contacts' ? csvLeadRowSchema : csvOpportunitySchema
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!
    const record: Record<string, string | number | null | undefined> = {}
    for (let c = 0; c < headers.length; c++) {
      const target = mapping[c]
      if (!target) continue
      const raw = row[c]?.trim() ?? ''
      if (raw === '') {
        record[target] = null
        continue
      }
      if (target === 'value' || target === 'probability') {
        const num = Number(raw)
        record[target] = Number.isFinite(num) ? num : null
      } else {
        record[target] = raw
      }
    }
    const parsed = schema.safeParse(record)
    if (parsed.success) {
      out.rows.push(parsed.data as Record<string, unknown>)
    } else {
      const first = parsed.error.issues[0]
      out.errors.push({
        row: r,
        message: `${first?.path.join('.') ?? 'row'}: ${first?.message ?? 'invalid'}`,
      })
    }
  }
  return out
}
