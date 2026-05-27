import Link from 'next/link'
import { FileQuestion, Home } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Logo } from '@/components/layout/logo'
import { cn } from '@/lib/utils'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="size-10 text-muted-foreground" />
        </div>

        <h1 className="mb-2 text-4xl font-bold tracking-tight">404</h1>
        <h2 className="mb-4 text-xl font-semibold">Page Not Found</h2>
        <p className="mb-8 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <Link href="/" className={cn(buttonVariants())}>
          <Home className="size-4" />
          Go Home
        </Link>
      </div>
    </div>
  )
}
