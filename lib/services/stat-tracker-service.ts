// Statistics tracker — Hubbard-style Divisions → Metrics → Data
// points. Admins configure divisions + metric cards; assigned users
// (and admins) record weekly values. All roles with admin/stat
// access read the whole board.
//
// Authorization notes:
//   - listDivisionsWithMetrics/listDataPoints: caller must be admin
//     or team (handled at the route/action layer).
//   - createDivision / updateDivision / archiveDivision: admin only.
//   - createMetric / updateMetric / archiveMetric: admin only.
//   - upsertDataPoint: admin OR the metric's assignedTo user.
//
// The service keeps its own admin/assignee checks so a
// misconfigured caller can't bypass authz just by importing the
// helper.

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

// ============================================================
// TYPES
// ============================================================

export type StatMetricUnit = 'COUNT' | 'CURRENCY' | 'PERCENT'

export interface StatDivisionSummary {
  id: string
  name: string
  shortLabel: string | null
  description: string | null
  orderIndex: number
  metricCount: number
}

export interface StatMetricRow {
  id: string
  name: string
  description: string | null
  unit: StatMetricUnit
  orderIndex: number
  targetValue: number | null
  division: { id: string; name: string; shortLabel: string | null }
  /** The Employee accountable for this metric (from /admin/onboarding).
   *  `userId` mirrors the linked User account for "mine" / permission
   *  checks; null when the employee has no system access. */
  assignedTo: {
    id: string
    userId: string | null
    name: string
    roleTitle: string
    status: 'ACTIVE' | 'OFFBOARDED'
  } | null
  latestValue: number | null
  latestRecordedAt: Date | null
  dataPoints: StatDataPoint[]
}

export interface StatDataPoint {
  id: string
  value: number
  recordedAt: Date
  note: string | null
  createdBy: { id: string; name: string | null; email: string } | null
}

export interface CreateDivisionInput {
  name: string
  shortLabel?: string | null
  description?: string | null
}

export interface UpdateDivisionInput {
  name?: string
  shortLabel?: string | null
  description?: string | null
  orderIndex?: number
}

export interface CreateMetricInput {
  divisionId: string
  name: string
  description?: string | null
  unit?: StatMetricUnit
  assignedToId?: string | null
  targetValue?: number | null
}

export interface UpdateMetricInput {
  name?: string
  description?: string | null
  unit?: StatMetricUnit
  assignedToId?: string | null
  targetValue?: number | null
  orderIndex?: number
  divisionId?: string
}

export interface UpsertDataPointInput {
  metricId: string
  /** ISO date (YYYY-MM-DD). Multiple values on the same day upsert
   *  a single row via (metricId, recordedAt) unique. */
  recordedAt: string
  value: number
  note?: string | null
}

// ============================================================
// READ
// ============================================================

export async function listDivisions(): Promise<StatDivisionSummary[]> {
  const rows = await prisma.statDivision.findMany({
    where: { deletedAt: null },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      shortLabel: true,
      description: true,
      orderIndex: true,
      _count: { select: { metrics: { where: { deletedAt: null } } } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    shortLabel: r.shortLabel,
    description: r.description,
    orderIndex: r.orderIndex,
    metricCount: r._count.metrics,
  }))
}

/**
 * Full board read across every non-deleted division. Includes each
 * metric with the last N data points so the UI can filter + render
 * without a second roundtrip. `points` defaults to 26 (~6 months
 * of weekly grain).
 */
export async function listAllMetrics(
  points: number = 26,
): Promise<StatMetricRow[]> {
  const metrics = await prisma.statMetric.findMany({
    where: { deletedAt: null, division: { deletedAt: null } },
    orderBy: [
      { division: { orderIndex: 'asc' } },
      { orderIndex: 'asc' },
      { createdAt: 'asc' },
    ],
    select: {
      id: true,
      name: true,
      description: true,
      unit: true,
      orderIndex: true,
      targetValue: true,
      division: { select: { id: true, name: true, shortLabel: true } },
      assignedTo: {
        select: {
          id: true,
          userId: true,
          name: true,
          roleTitle: true,
          status: true,
        },
      },
      dataPoints: {
        orderBy: { recordedAt: 'desc' },
        take: points,
        select: {
          id: true,
          value: true,
          recordedAt: true,
          note: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })
  return metrics.map(shapeMetricRow)
}

/**
 * Full board read for a single division. Includes each metric with
 * the last N data points so the UI can render sparklines without a
 * second roundtrip. `points` defaults to 26 (~6 months of weekly
 * points), tunable per view.
 */
export async function listMetricsForDivision(
  divisionId: string,
  points: number = 26,
): Promise<StatMetricRow[]> {
  const metrics = await prisma.statMetric.findMany({
    where: { divisionId, deletedAt: null },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      unit: true,
      orderIndex: true,
      targetValue: true,
      division: { select: { id: true, name: true, shortLabel: true } },
      assignedTo: {
        select: {
          id: true,
          userId: true,
          name: true,
          roleTitle: true,
          status: true,
        },
      },
      dataPoints: {
        orderBy: { recordedAt: 'desc' },
        take: points,
        select: {
          id: true,
          value: true,
          recordedAt: true,
          note: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })

  return metrics.map(shapeMetricRow)
}

interface RawMetric {
  id: string
  name: string
  description: string | null
  unit: string
  orderIndex: number
  targetValue: Prisma.Decimal | null
  division: { id: string; name: string; shortLabel: string | null }
  assignedTo: {
    id: string
    userId: string | null
    name: string
    roleTitle: string
    status: 'ACTIVE' | 'OFFBOARDED'
  } | null
  dataPoints: {
    id: string
    value: Prisma.Decimal
    recordedAt: Date
    note: string | null
    createdBy: { id: string; name: string | null; email: string } | null
  }[]
}

function shapeMetricRow(m: RawMetric): StatMetricRow {
  // Points come back newest-first from the take-N query; the chart
  // wants oldest-first for its x-axis.
  const orderedPoints = [...m.dataPoints].reverse()
  const latest = orderedPoints[orderedPoints.length - 1] ?? null
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    unit: m.unit as StatMetricUnit,
    orderIndex: m.orderIndex,
    targetValue: m.targetValue?.toNumber() ?? null,
    division: m.division,
    assignedTo: m.assignedTo,
    latestValue: latest?.value.toNumber() ?? null,
    latestRecordedAt: latest?.recordedAt ?? null,
    dataPoints: orderedPoints.map((p) => ({
      id: p.id,
      value: p.value.toNumber(),
      recordedAt: p.recordedAt,
      note: p.note,
      createdBy: p.createdBy,
    })),
  }
}

// ============================================================
// DIVISION CRUD
// ============================================================

export async function createDivision(
  input: CreateDivisionInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Name is required' }

  const nextOrder = await nextOrderIndex('stat_divisions')
  const created = await prisma.statDivision.create({
    data: {
      name,
      shortLabel: input.shortLabel?.trim() || null,
      description: input.description?.trim() || null,
      orderIndex: nextOrder,
    },
    select: { id: true },
  })
  return { ok: true, id: created.id }
}

export async function updateDivision(
  id: string,
  input: UpdateDivisionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.statDivision.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  })
  if (!existing) return { ok: false, error: 'Division not found' }

  await prisma.statDivision.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.shortLabel !== undefined
        ? { shortLabel: input.shortLabel?.trim() || null }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.orderIndex !== undefined ? { orderIndex: input.orderIndex } : {}),
    },
  })
  return { ok: true }
}

export async function archiveDivision(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.statDivision.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  })
  if (!existing) return { ok: false, error: 'Division not found' }

  await prisma.statDivision.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
  // Soft-delete all metrics in the division too so they disappear
  // from the board immediately. Data points stay for history.
  await prisma.statMetric.updateMany({
    where: { divisionId: id, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  return { ok: true }
}

/**
 * Permanently delete a division. FK cascades wipe all metrics under
 * it and every data point under those metrics. There is no recovery
 * — the caller must confirm.
 */
export async function deleteDivision(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.statDivision.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) return { ok: false, error: 'Division not found' }
  await prisma.statDivision.delete({ where: { id } })
  return { ok: true }
}

// ============================================================
// METRIC CRUD
// ============================================================

export async function createMetric(
  input: CreateMetricInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Name is required' }

  const division = await prisma.statDivision.findFirst({
    where: { id: input.divisionId, deletedAt: null },
    select: { id: true },
  })
  if (!division) return { ok: false, error: 'Division not found' }

  if (input.assignedToId) {
    // Existence check only — offboarded employees stay assignable so
    // historical stat imports can attribute metrics to whoever
    // actually owned them at the time.
    const assignee = await prisma.employee.findUnique({
      where: { id: input.assignedToId },
      select: { id: true },
    })
    if (!assignee) return { ok: false, error: 'Assignee not found' }
  }

  const nextOrder = await prisma.statMetric.count({
    where: { divisionId: input.divisionId },
  })

  const created = await prisma.statMetric.create({
    data: {
      divisionId: input.divisionId,
      name,
      description: input.description?.trim() || null,
      unit: (input.unit ?? 'COUNT') as StatMetricUnit,
      assignedToId: input.assignedToId ?? null,
      targetValue:
        input.targetValue != null
          ? new Prisma.Decimal(input.targetValue)
          : null,
      orderIndex: nextOrder,
    },
    select: { id: true },
  })
  return { ok: true, id: created.id }
}

export async function updateMetric(
  id: string,
  input: UpdateMetricInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.statMetric.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  })
  if (!existing) return { ok: false, error: 'Metric not found' }

  if (input.divisionId) {
    const division = await prisma.statDivision.findFirst({
      where: { id: input.divisionId, deletedAt: null },
      select: { id: true },
    })
    if (!division) return { ok: false, error: 'Division not found' }
  }
  if (input.assignedToId) {
    // Existence check only — offboarded employees stay assignable so
    // historical stat imports can attribute metrics to whoever
    // actually owned them at the time.
    const assignee = await prisma.employee.findUnique({
      where: { id: input.assignedToId },
      select: { id: true },
    })
    if (!assignee) return { ok: false, error: 'Assignee not found' }
  }

  await prisma.statMetric.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.assignedToId !== undefined
        ? { assignedToId: input.assignedToId }
        : {}),
      ...(input.divisionId !== undefined ? { divisionId: input.divisionId } : {}),
      ...(input.targetValue !== undefined
        ? {
            targetValue:
              input.targetValue != null
                ? new Prisma.Decimal(input.targetValue)
                : null,
          }
        : {}),
      ...(input.orderIndex !== undefined ? { orderIndex: input.orderIndex } : {}),
    },
  })
  return { ok: true }
}

export async function archiveMetric(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.statMetric.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  })
  if (!existing) return { ok: false, error: 'Metric not found' }

  await prisma.statMetric.update({
    where: { id },
    data: { deletedAt: new Date() },
  })
  return { ok: true }
}

/**
 * Permanently delete a metric. FK cascade wipes every recorded
 * data point. Irreversible.
 */
export async function deleteMetric(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.statMetric.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!existing) return { ok: false, error: 'Metric not found' }
  await prisma.statMetric.delete({ where: { id } })
  return { ok: true }
}

// ============================================================
// DATA POINT ENTRY
// ============================================================

/**
 * Insert or update a data point on a metric. Only the metric's
 * assigned user records values; when a metric has no assignee, an
 * admin is allowed to fill in so the card doesn't stay blank
 * forever. This mirrors the "ownership = accountability" pattern
 * from the Hubbard stat board — admins configure, assignees own.
 * Value at (metric, date) upserts a single row via the unique
 * constraint.
 */
export async function upsertDataPoint(
  actorUserId: string,
  actorIsAdmin: boolean,
  input: UpsertDataPointInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const metric = await prisma.statMetric.findFirst({
    where: { id: input.metricId, deletedAt: null },
    select: {
      id: true,
      assignedToId: true,
      assignedTo: { select: { userId: true } },
    },
  })
  if (!metric) return { ok: false, error: 'Metric not found' }

  // Ownership authz compares the actor's User.id against the linked
  // User of the assignee Employee. Employees without a User account
  // can be owners on paper (see createMetric) but can't record values
  // themselves — an admin fills in on their behalf.
  const isAssignee =
    metric.assignedTo?.userId !== undefined &&
    metric.assignedTo.userId !== null &&
    metric.assignedTo.userId === actorUserId
  const isUnassignedAdmin = metric.assignedToId === null && actorIsAdmin
  if (!isAssignee && !isUnassignedAdmin) {
    return {
      ok: false,
      error: 'Only the assigned user can record values on this metric',
    }
  }

  if (!Number.isFinite(input.value)) {
    return { ok: false, error: 'Value must be a number' }
  }

  const recordedAt = new Date(input.recordedAt)
  if (Number.isNaN(recordedAt.valueOf())) {
    return { ok: false, error: 'Invalid recorded date' }
  }

  const upserted = await prisma.statDataPoint.upsert({
    where: {
      metricId_recordedAt: {
        metricId: input.metricId,
        recordedAt,
      },
    },
    update: {
      value: new Prisma.Decimal(input.value),
      note: input.note?.trim() || null,
      createdById: actorUserId,
    },
    create: {
      metricId: input.metricId,
      recordedAt,
      value: new Prisma.Decimal(input.value),
      note: input.note?.trim() || null,
      createdById: actorUserId,
    },
    select: { id: true },
  })
  return { ok: true, id: upserted.id }
}

export async function deleteDataPoint(
  actorUserId: string,
  actorIsAdmin: boolean,
  dataPointId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const point = await prisma.statDataPoint.findUnique({
    where: { id: dataPointId },
    select: {
      id: true,
      metric: {
        select: {
          assignedToId: true,
          assignedTo: { select: { userId: true } },
        },
      },
    },
  })
  if (!point) return { ok: false, error: 'Data point not found' }

  // Symmetric with upsertDataPoint: only the assigned employee's
  // linked User (or an admin on an unassigned metric) can delete.
  const assigneeUserId = point.metric.assignedTo?.userId ?? null
  const isAssignee = assigneeUserId !== null && assigneeUserId === actorUserId
  const isUnassignedAdmin = point.metric.assignedToId === null && actorIsAdmin
  if (!isAssignee && !isUnassignedAdmin) {
    return { ok: false, error: 'Only the assigned user can delete values' }
  }

  await prisma.statDataPoint.delete({ where: { id: dataPointId } })
  return { ok: true }
}

// ============================================================
// INTERNALS
// ============================================================

async function nextOrderIndex(
  table: 'stat_divisions',
): Promise<number> {
  if (table === 'stat_divisions') {
    const last = await prisma.statDivision.findFirst({
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    })
    return (last?.orderIndex ?? -1) + 1
  }
  return 0
}
