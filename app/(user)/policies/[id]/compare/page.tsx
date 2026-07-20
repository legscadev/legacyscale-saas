import { notFound } from 'next/navigation'

import {
  fetchPolicyDetailAction,
  fetchPolicyRevisionAction,
} from '@/app/(admin)/admin/policies/actions'
import { PolicyCompareView } from '@/components/admin/policies/policy-compare-view'
import {
  CURRENT_SENTINEL,
  buildSnapshot,
} from '@/components/admin/policies/policy-compare-shared'
import { requireTeamOrAdmin } from '@/lib/auth'
import type { PolicyRevisionDetail } from '@/lib/services/policy-service'

export const dynamic = 'force-dynamic'

interface MemberPolicyComparePageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function resolveSlot(
  policyId: string,
  raw: string | undefined,
): Promise<PolicyRevisionDetail | null> {
  if (!raw || raw === CURRENT_SENTINEL) return null
  const res = await fetchPolicyRevisionAction(raw)
  if (!res.ok) return null
  if (res.data.policyId !== policyId) return null
  return res.data
}

export default async function MemberPolicyComparePage({
  params,
  searchParams,
}: MemberPolicyComparePageProps) {
  await requireTeamOrAdmin()
  const { id } = await params
  const raw = await searchParams
  const scalar = (v: string | string[] | undefined) =>
    v === undefined ? undefined : Array.isArray(v) ? v[0] : v

  const detailResult = await fetchPolicyDetailAction(id)
  if (!detailResult.ok) notFound()
  const { policy, revisions } = detailResult.data

  const priorRevisionId =
    revisions.find((r) => r.revision < policy.revision)?.id ??
    CURRENT_SENTINEL
  const effectiveFrom = scalar(raw.from) ?? priorRevisionId
  const effectiveTo = scalar(raw.to) ?? CURRENT_SENTINEL

  const [leftRevision, rightRevision] = await Promise.all([
    resolveSlot(id, effectiveFrom),
    resolveSlot(id, effectiveTo),
  ])

  const leftSnapshot = buildSnapshot({ policy, revision: leftRevision })
  const rightSnapshot = buildSnapshot({ policy, revision: rightRevision })

  return (
    <PolicyCompareView
      policy={policy}
      revisions={revisions}
      leftSnapshot={leftSnapshot}
      rightSnapshot={rightSnapshot}
      canWrite={false}
      basePath="/policies"
    />
  )
}
