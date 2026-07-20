import { notFound } from 'next/navigation'

import { fetchPolicyDetailAction } from '@/app/(admin)/admin/policies/actions'
import { PolicyPrintView } from '@/components/admin/policies/policy-print-view'
import { requireAdmin } from '@/lib/auth/get-user'
import { getActiveCompany } from '@/lib/tenancy/active-company'

export const dynamic = 'force-dynamic'

interface PolicyPrintPageProps {
  params: Promise<{ id: string }>
}

export default async function PolicyPrintPage({
  params,
}: PolicyPrintPageProps) {
  await requireAdmin()
  const { id } = await params

  const [detail, company] = await Promise.all([
    fetchPolicyDetailAction(id),
    getActiveCompany(),
  ])
  if (!detail.ok) notFound()

  return <PolicyPrintView data={detail.data} companyName={company?.name ?? null} />
}
