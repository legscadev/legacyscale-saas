import { notFound } from 'next/navigation'

import { fetchPolicyAction, fetchPolicyRevisionAction } from '@/app/(admin)/admin/policies/actions'
import { PolicyRevisionView } from '@/components/admin/policies/policy-revision-view'
import { requireAdmin } from '@/lib/auth/get-user'

export const dynamic = 'force-dynamic'

interface PolicyRevisionPageProps {
  params: Promise<{ id: string; revisionId: string }>
}

export default async function PolicyRevisionPage({
  params,
}: PolicyRevisionPageProps) {
  await requireAdmin()
  const { id, revisionId } = await params

  const [policyResult, revisionResult] = await Promise.all([
    fetchPolicyAction(id),
    fetchPolicyRevisionAction(revisionId),
  ])
  if (!policyResult.ok || !revisionResult.ok) notFound()

  // Guard against a mismatched revisionId (e.g. an admin pasted a
  // link that belongs to a different policy). The service raises
  // RevisionMismatchError only on revert, so we check ownership
  // here before rendering.
  if (revisionResult.data.policyId !== id) notFound()

  return (
    <PolicyRevisionView
      policy={policyResult.data}
      revision={revisionResult.data}
    />
  )
}
