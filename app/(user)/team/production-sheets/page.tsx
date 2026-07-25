import { redirect } from 'next/navigation'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { ProductionShell } from '@/components/admin/production/production-shell'

import {
  fetchAppointments,
  fetchEntries,
  fetchMonthlyAggregates,
  fetchTargets,
} from '@/app/(admin)/admin/production-sheets/actions'

// TEAM-side wrapper for the Production sheet. ADMIN gets bounced
// to the admin surface where the user picker lives.

export const dynamic = 'force-dynamic'

interface TeamProductionPageProps {
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function TeamProductionPage({ searchParams }: TeamProductionPageProps) {
  const viewer = await requireTeamModuleAccess('production')
  if (viewer.role === 'ADMIN') redirect('/admin/production-sheets')

  const params = await searchParams
  const now = new Date()
  const year = Number(params.year) || now.getFullYear()
  const month = Number(params.month) || now.getMonth() + 1

  const [entries, targets, appointments, aggregates] = await Promise.all([
    fetchEntries(viewer.id, year, month),
    fetchTargets(viewer.id, year, month),
    fetchAppointments({ userId: viewer.id, year, month }),
    fetchMonthlyAggregates(viewer.id, 12),
  ])

  return (
    <ProductionShell
      currentUserId={viewer.id}
      currentUserIsAdmin={false}
      users={[]}
      initialTargetUserId={viewer.id}
      initialYear={year}
      initialMonth={month}
      initialEntries={entries}
      initialTargets={targets}
      initialAppointments={appointments}
      initialAggregates={aggregates}
    />
  )
}
