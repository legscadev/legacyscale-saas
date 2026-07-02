import { requireAdmin } from '@/lib/auth/get-user'
import { employeeService } from '@/lib/services/employee-service'
import { checklistTemplateService } from '@/lib/services/checklist-template-service'
import { OnboardingShell } from '@/components/admin/onboarding/onboarding-shell'

export const metadata = {
  title: 'Onboarding — Admin',
}

// Small dataset (~dozens). Fetch once server-side and let the client
// shell handle tab + search filtering to avoid re-fetch churn.
export default async function OnboardingAdminPage() {
  await requireAdmin()
  const [employees, templates] = await Promise.all([
    employeeService.list(),
    checklistTemplateService.list(),
  ])
  return (
    <OnboardingShell
      initialEmployees={employees}
      initialTemplates={templates}
    />
  )
}
