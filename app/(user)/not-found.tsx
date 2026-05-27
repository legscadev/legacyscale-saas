import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/shared'
import { cn } from '@/lib/utils'

export default function UserNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={FileQuestion}
        title="Page Not Found"
        description="The page you're looking for doesn't exist."
      >
        <Link href="/dashboard" className={cn(buttonVariants())}>
          Back to Dashboard
        </Link>
      </EmptyState>
    </div>
  )
}
