'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared'

interface UserErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function UserError({ error, reset }: UserErrorProps) {
  useEffect(() => {
    console.error('User error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={AlertTriangle}
        title="Something Went Wrong"
        description="An error occurred. Please try again."
      >
        <Button onClick={reset}>
          <RefreshCw className="size-4" />
          Try Again
        </Button>
      </EmptyState>
    </div>
  )
}
