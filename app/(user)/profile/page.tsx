import { PageHeader } from '@/components/shared'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { requireActiveUser } from '@/lib/auth'
import { AvatarUpload } from './avatar-upload'
import { ChangePasswordForm } from './change-password-form'
import { ProfileForm } from './profile-form'

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  return email[0]!.toUpperCase()
}

export default async function UserProfilePage() {
  const user = await requireActiveUser()

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Manage your account settings" />

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {user.authId ? (
            <AvatarUpload
              authId={user.authId}
              initialAvatarUrl={user.avatarUrl}
              fallbackText={getInitials(user.name, user.email)}
            />
          ) : null}
          <ProfileForm initialName={user.name ?? ''} email={user.email} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>
            Change the password you use to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
