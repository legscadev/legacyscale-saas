import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { ProductionShell } from '@/components/admin/production/production-shell'

import {
  fetchAppointments,
  fetchEntries,
  fetchMonthlyAggregates,
  fetchProductionUsers,
  fetchTargets,
} from './actions'

export const dynamic = 'force-dynamic'

interface ProductionPageProps {
  searchParams: Promise<{ user?: string; year?: string; month?: string }>
}

export default async function AdminProductionPage({ searchParams }: ProductionPageProps) {
  const viewer = await requireTeamModuleAccess('production')
  const params = await searchParams
  const isAdmin = viewer.role === 'ADMIN'

  const now = new Date()
  const year = Number(params.year) || now.getFullYear()
  const month = Number(params.month) || now.getMonth() + 1

  const users = isAdmin ? await fetchProductionUsers() : []
  const targetUserId = isAdmin
    ? (params.user && users.some((u) => u.id === params.user) ? params.user : viewer.id)
    : viewer.id

  const [entries, targets, appointments, aggregates] = await Promise.all([
    fetchEntries(targetUserId, year, month),
    fetchTargets(targetUserId, year, month),
    fetchAppointments({ userId: targetUserId, year, month }),
    fetchMonthlyAggregates(targetUserId, 12),
  ])

  return (
    <ProductionShell
      currentUserId={viewer.id}
      currentUserIsAdmin={isAdmin}
      users={users}
      initialTargetUserId={targetUserId}
      initialYear={year}
      initialMonth={month}
      initialEntries={entries}
      initialTargets={targets}
      initialAppointments={appointments}
      initialAggregates={aggregates}
    />
  )
}
