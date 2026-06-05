import { redirect } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth/actions'
import { getUser } from '@/lib/auth/get-user'

export default async function AccessRevokedPage() {
  const user = await getUser()

  // Only deactivated users belong here — gate out everyone else so the
  // page can't be browsed casually.
  if (!user) redirect('/login')
  if (user.isActive) {
    redirect(user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard')
  }


  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Account Paused</CardTitle>
          <CardDescription>
            Your access is currently paused.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            If you think this is a mistake,{' '}
            <a
              href="mailto:support@kondense.ai"
              className="font-medium text-primary hover:underline"
            >
              contact support
            </a>{' '}
            and we&apos;ll sort it out.
          </p>
          <form action={signOut}>
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
