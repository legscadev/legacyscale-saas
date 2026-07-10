import { PageHeader } from '@/components/shared/page-header'
import { CreateCompanyForm } from '@/components/super/companies/create-company-form'

export default function NewCompanyPage() {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Create a company"
        description="Stand up a new tenant with an initial OWNER. Snapshot content later from the company detail page."
      />
      <CreateCompanyForm />
    </div>
  )
}
