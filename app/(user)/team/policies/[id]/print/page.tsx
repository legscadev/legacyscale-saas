import { notFound } from 'next/navigation'

import { fetchPolicyDetailAction } from '@/app/(admin)/admin/policies/actions'
import { PolicyPrintView } from '@/components/admin/policies/policy-print-view'
import { requireTeamOrAdmin } from '@/lib/auth'
import { getActiveCompany } from '@/lib/tenancy/active-company'

export const dynamic = 'force-dynamic'

interface MemberPolicyPrintPageProps {
  params: Promise<{ id: string }>
}

export default async function MemberPolicyPrintPage({
  params,
}: MemberPolicyPrintPageProps) {
  await requireTeamOrAdmin()
  const { id } = await params

  const [detail, company] = await Promise.all([
    fetchPolicyDetailAction(id),
    getActiveCompany(),
  ])
  if (!detail.ok) notFound()

  return (
    <PolicyPrintView
      data={detail.data}
      companyName={company?.name ?? null}
      basePath="/team/policies"
    />
  )
}
