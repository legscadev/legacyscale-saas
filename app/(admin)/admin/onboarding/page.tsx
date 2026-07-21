import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { employeeService } from '@/lib/services/employee-service'
import { checklistService } from '@/lib/services/checklist-service'
import { OnboardingShell } from '@/components/admin/onboarding/onboarding-shell'

export const metadata = {
  title: 'Onboarding — Admin',
}

// Small dataset (~dozens). Fetch once server-side and let the client
// shell handle tab + search filtering to avoid re-fetch churn.
export default async function OnboardingAdminPage() {
  await requireTeamModuleAccess('onboarding')
  const [employees, items] = await Promise.all([
    employeeService.list(),
    checklistService.listItems(),
  ])
  return <OnboardingShell initialEmployees={employees} initialItems={items} />
}
