import { PageHeader } from '@/components/shared'
import { ProfileContent } from '@/components/profile/profile-content'
import { NotificationPreferences } from '@/components/profile/notification-preferences'
import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function UserProfilePage() {
  const user = await requireActiveUser()
  const prefs = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      notifyAnnouncementEmail: true,
      notifyAnnouncementDiscord: true,
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Manage your account settings" />
      <ProfileContent user={user} />
      <NotificationPreferences
        initial={{
          notifyAnnouncementEmail: prefs?.notifyAnnouncementEmail ?? true,
          notifyAnnouncementDiscord: prefs?.notifyAnnouncementDiscord ?? true,
        }}
      />
    </div>
  )
}
