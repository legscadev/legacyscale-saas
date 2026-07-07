import { requireAdmin } from '@/lib/auth/get-user'
import { checklistService } from '@/lib/services/checklist-service'
import { ChecklistEditor } from '@/components/admin/onboarding/checklist-editor'

export const metadata = {
  title: 'Onboarding checklist — Admin',
}

export default async function OnboardingChecklistPage() {
  await requireAdmin()
  const items = await checklistService.listItems()
  return <ChecklistEditor initialItems={items} />
}
