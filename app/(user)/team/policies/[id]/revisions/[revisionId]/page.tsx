import { notFound } from 'next/navigation'

import {
  fetchPolicyAction,
  fetchPolicyRevisionAction,
} from '@/app/(admin)/admin/policies/actions'
import { PolicyRevisionView } from '@/components/admin/policies/policy-revision-view'
import { requireTeamOrAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface MemberPolicyRevisionPageProps {
  params: Promise<{ id: string; revisionId: string }>
}

export default async function MemberPolicyRevisionPage({
  params,
}: MemberPolicyRevisionPageProps) {
  await requireTeamOrAdmin()
  const { id, revisionId } = await params

  const [policyResult, revisionResult] = await Promise.all([
    fetchPolicyAction(id),
    fetchPolicyRevisionAction(revisionId),
  ])
  if (!policyResult.ok || !revisionResult.ok) notFound()
  if (revisionResult.data.policyId !== id) notFound()

  return (
    <PolicyRevisionView
      policy={policyResult.data}
      revision={revisionResult.data}
      canWrite={false}
      basePath="/team/policies"
    />
  )
}
