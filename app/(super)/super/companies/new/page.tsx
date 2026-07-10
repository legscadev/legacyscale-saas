import { PageHeader } from '@/components/shared/page-header'
import { CreateCompanyForm } from '@/components/super/companies/create-company-form'

import { listSnapshotSources } from '../actions'

export const dynamic = 'force-dynamic'

export default async function NewCompanyPage() {
  const snapshotSources = await listSnapshotSources()

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Create a company"
        description="Stand up a new tenant with an initial OWNER. Optionally seed it with a snapshot of another tenant's catalog."
      />
      <CreateCompanyForm snapshotSources={snapshotSources} />
    </div>
  )
}
