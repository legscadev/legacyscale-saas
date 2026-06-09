import Link from 'next/link'
import { Home, LogIn, ShieldX } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Logo } from '@/components/layout/logo'
import { cn } from '@/lib/utils'

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="size-10 text-destructive" />
        </div>

        <h1 className="mb-2 text-4xl font-bold tracking-tight">403</h1>
        <h2 className="mb-4 text-xl font-semibold">Access Denied</h2>
        <p className="mb-8 text-muted-foreground">
          You don&apos;t have permission to access this page. Contact an
          administrator if you believe this is an error.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className={cn(buttonVariants())}>
            <Home className="size-4" />
            Go Home
          </Link>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: 'outline' }))}
          >
            <LogIn className="size-4" />
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
