import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/shared'
import { cn } from '@/lib/utils'

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={FileQuestion}
        title="Page Not Found"
        description="The admin page you're looking for doesn't exist."
      >
        <Link href="/admin/dashboard" className={cn(buttonVariants())}>
          Back to Admin Dashboard
        </Link>
      </EmptyState>
    </div>
  )
}
