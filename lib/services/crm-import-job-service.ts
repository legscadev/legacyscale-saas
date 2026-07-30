// Tracks CSV import runs from the /admin/crm/import wizard.
// Powers the "Previous imports" history + gives each import row a
// stable id so retry / audit UIs can reference it later.
//
// A row starts in RUNNING, then the caller updates it once the
// insert loop finishes with the final counts + status. We don't
// stream row-level progress — the wizard's insert is sync and
// finishes in seconds for our schema-capped 2000-row files.

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { getRequestCompanyId } from '@/lib/tenancy/request-company'

export type ImportJobObject = 'CONTACTS' | 'OPPORTUNITIES'
export type ImportJobMode =
  | 'CREATE_ONLY'
  | 'CREATE_OR_UPDATE'
  | 'UPDATE_ONLY'
export type ImportJobStatus = 'RUNNING' | 'COMPLETE' | 'FAILED'

export interface ImportJobRow {
  id: string
  object: ImportJobObject
  mode: ImportJobMode
  status: ImportJobStatus
  fileName: string | null
  fileSize: number | null
  rowsTotal: number
  rowsCreated: number
  rowsUpdated: number
  rowsSkipped: number
  rowsFailed: number
  errorMessage: string | null
  actor: { id: string; name: string | null; email: string } | null
  createdAt: Date
  completedAt: Date | null
}

async function requireCompanyId(): Promise<string> {
  const id = await getRequestCompanyId()
  if (!id) throw new Error('crm-import-job-service: no active company')
  return id
}

const LIST_SELECT = {
  id: true,
  object: true,
  mode: true,
  status: true,
  fileName: true,
  fileSize: true,
  rowsTotal: true,
  rowsCreated: true,
  rowsUpdated: true,
  rowsSkipped: true,
  rowsFailed: true,
  errorMessage: true,
  createdAt: true,
  completedAt: true,
  actor: { select: { id: true, name: true, email: true } },
} as const satisfies Prisma.CrmImportJobSelect

class CrmImportJobService {
  /** Recent history for the actor. Cap at 50 — the wizard link is a
   *  quick jump, not a full audit trail. */
  async list(actorId: string): Promise<ImportJobRow[]> {
    const rows = await prisma.crmImportJob.findMany({
      where: { actorId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: LIST_SELECT,
    })
    return rows.map(toRow)
  }

  async start(input: {
    object: ImportJobObject
    mode: ImportJobMode
    rowsTotal: number
    fileName?: string | null
    fileSize?: number | null
    params?: Prisma.InputJsonValue
    actorId: string | null
  }): Promise<{ id: string }> {
    const companyId = await requireCompanyId()
    const row = await prisma.crmImportJob.create({
      data: {
        companyId,
        object: input.object,
        mode: input.mode,
        status: 'RUNNING',
        rowsTotal: input.rowsTotal,
        fileName: input.fileName ?? null,
        fileSize: input.fileSize ?? null,
        params: input.params,
        actorId: input.actorId,
      },
      select: { id: true },
    })
    return row
  }

  async complete(input: {
    jobId: string
    rowsCreated: number
    rowsUpdated: number
    rowsSkipped: number
    rowsFailed: number
  }): Promise<void> {
    await prisma.crmImportJob.update({
      where: { id: input.jobId },
      data: {
        status: 'COMPLETE',
        rowsCreated: input.rowsCreated,
        rowsUpdated: input.rowsUpdated,
        rowsSkipped: input.rowsSkipped,
        rowsFailed: input.rowsFailed,
        completedAt: new Date(),
      },
    })
  }

  async fail(input: {
    jobId: string
    errorMessage: string
  }): Promise<void> {
    await prisma.crmImportJob.update({
      where: { id: input.jobId },
      data: {
        status: 'FAILED',
        errorMessage: input.errorMessage.slice(0, 2000),
        completedAt: new Date(),
      },
    })
  }
}

function toRow(
  row: Prisma.CrmImportJobGetPayload<{ select: typeof LIST_SELECT }>,
): ImportJobRow {
  return {
    id: row.id,
    object: row.object as ImportJobObject,
    mode: row.mode as ImportJobMode,
    status: row.status as ImportJobStatus,
    fileName: row.fileName,
    fileSize: row.fileSize,
    rowsTotal: row.rowsTotal,
    rowsCreated: row.rowsCreated,
    rowsUpdated: row.rowsUpdated,
    rowsSkipped: row.rowsSkipped,
    rowsFailed: row.rowsFailed,
    errorMessage: row.errorMessage,
    actor: row.actor,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  }
}

export const crmImportJobService = new CrmImportJobService()
