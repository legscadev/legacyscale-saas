import Link from 'next/link'
import { Plus } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
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
        actions={
          <Button render={<Link href="/super/companies/new" />}>
            <Plus />
            Create company
          </Button>
        }
      />
      <CompaniesShell initialData={initialData} />
    </div>
  )
}
