import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function AuthCodeErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Authentication Error</CardTitle>
          <CardDescription>
            There was a problem with the authentication link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The link may have expired or already been used. Please try again.
          </p>
          <Link href="/login" className={cn(buttonVariants(), 'w-full')}>
            Back to Login
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
