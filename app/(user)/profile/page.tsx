import { PageHeader } from '@/components/shared'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { requireActiveUser } from '@/lib/auth'

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
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatarUrl ?? undefined} />
              <AvatarFallback className="text-lg">
                {getInitials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm">
              Upload Photo
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" defaultValue={user.name ?? ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue={user.email} disabled />
            </div>
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  )
}
