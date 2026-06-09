import { PageHeader } from '@/components/shared'
import { ProfileContent } from '@/components/profile/profile-content'
import { requireAdmin } from '@/lib/auth'

export default async function AdminProfilePage() {
  const admin = await requireAdmin()

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Manage your account settings" />
      <ProfileContent user={admin} />
    </div>
  )
}
