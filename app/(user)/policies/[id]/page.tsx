import { notFound } from 'next/navigation'

import { fetchPolicyDetailAction } from '@/app/(admin)/admin/policies/actions'
import { PolicyDetailView } from '@/components/admin/policies/policy-detail-view'
import { requireTeamOrAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface MemberPolicyDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function MemberPolicyDetailPage({
  params,
}: MemberPolicyDetailPageProps) {
  await requireTeamOrAdmin()
  const { id } = await params

  const result = await fetchPolicyDetailAction(id)
  if (!result.ok) notFound()

  return (
    <PolicyDetailView
      data={result.data}
      canWrite={false}
      basePath="/policies"
    />
  )
}
