import { redirect } from 'next/navigation'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { employeeService } from '@/lib/services/employee-service'
import { checklistService } from '@/lib/services/checklist-service'
import { OnboardingShell } from '@/components/admin/onboarding/onboarding-shell'

// TEAM-side wrapper for Onboarding. ADMIN gets bounced to
// /admin/onboarding. Note: this /team/onboarding is the *internal*
// Onboarding module (new-hire checklists) — distinct from the
// top-level /onboarding route which is the new-user signup flow.

export const metadata = {
  title: 'Onboarding',
}

export default async function TeamOnboardingPage() {
  const viewer = await requireTeamModuleAccess('onboarding')
  if (viewer.role === 'ADMIN') redirect('/admin/onboarding')

  const [employees, items] = await Promise.all([
    employeeService.list(),
    checklistService.listItems(),
  ])
  return <OnboardingShell initialEmployees={employees} initialItems={items} />
}
