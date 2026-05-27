'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Logo } from '@/components/layout/logo'
import { cn } from '@/lib/utils'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="size-10 text-destructive" />
        </div>

        <h1 className="mb-2 text-4xl font-bold tracking-tight">Oops!</h1>
        <h2 className="mb-4 text-xl font-semibold">Something Went Wrong</h2>
        <p className="mb-8 text-muted-foreground">
          An unexpected error occurred. Our team has been notified and is
          working on a fix.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="mb-8 rounded-lg bg-muted p-4 text-left">
            <p className="mb-2 text-sm font-medium text-destructive">
              Error Details:
            </p>
            <pre className="overflow-auto text-xs text-muted-foreground">
              {error.message}
            </pre>
            {error.digest && (
              <p className="mt-2 text-xs text-muted-foreground">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={reset}>
            <RefreshCw className="size-4" />
            Try Again
          </Button>
          <Link href="/" className={cn(buttonVariants({ variant: 'outline' }))}>
            <Home className="size-4" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}
