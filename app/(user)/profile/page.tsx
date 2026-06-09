import { PageHeader } from '@/components/shared'
import { ProfileContent } from '@/components/profile/profile-content'
import { requireActiveUser } from '@/lib/auth'

export default async function UserProfilePage() {
  const user = await requireActiveUser()

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Manage your account settings" />
      <ProfileContent user={user} />
    </div>
  )
}
