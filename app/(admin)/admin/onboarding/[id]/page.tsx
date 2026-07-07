import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/auth/get-user'
import { employeeService, type EmployeeDetail } from '@/lib/services/employee-service'
import { EmployeeDetailShell } from '@/components/admin/onboarding/employee-detail-shell'

export const metadata = {
  title: 'Employee — Onboarding',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EmployeeDetailPage({ params }: PageProps) {
  await requireAdmin()
  const { id } = await params

  let employee: EmployeeDetail
  try {
    employee = await employeeService.get(id)
  } catch (err) {
    if (err instanceof Error && err.message === 'Employee not found') {
      notFound()
    }
    throw err
  }
  return <EmployeeDetailShell employee={employee} />
}
