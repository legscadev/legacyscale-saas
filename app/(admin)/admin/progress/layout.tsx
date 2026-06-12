import { requireAdmin } from '@/lib/auth/get-user'
import { PageHeader } from '@/components/shared'
import { ProgressTabs } from '@/components/admin/progress/progress-tabs'

export default async function AdminProgressLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireAdmin()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progress Tracker"
        description="Track member engagement and course performance across the platform."
      />
      <ProgressTabs />
      {children}
    </div>
  )
}
