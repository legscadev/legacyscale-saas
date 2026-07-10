import { PageHeader } from '@/components/shared/page-header'
import { CompaniesShell } from '@/components/super/companies/companies-shell'

import { fetchCompanies } from './actions'

export const dynamic = 'force-dynamic'

export default async function SuperCompaniesPage() {
  const initialData = await fetchCompanies({
    search: '',
    kind: 'all',
    sort: 'name',
    direction: 'asc',
    page: 1,
  })

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Companies"
        description="Every tenant on the platform. Search, filter, and jump into any one as a super-admin."
      />
      <CompaniesShell initialData={initialData} />
    </div>
  )
}
