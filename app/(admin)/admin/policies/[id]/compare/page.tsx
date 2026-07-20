import { notFound } from 'next/navigation'

import {
  fetchPolicyDetailAction,
  fetchPolicyRevisionAction,
} from '@/app/(admin)/admin/policies/actions'
import {
  CURRENT_SENTINEL,
  PolicyCompareView,
  buildSnapshot,
} from '@/components/admin/policies/policy-compare-view'
import { requireAdmin } from '@/lib/auth/get-user'
import type { PolicyRevisionDetail } from '@/lib/services/policy-service'

export const dynamic = 'force-dynamic'

interface PolicyComparePageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Resolves a URL param — either 'current' / missing (→ null so the
 * shell fills in from the Policy row) or a revision UUID — into a
 * PolicyRevisionDetail or null.
 */
async function resolveSlot(
  policyId: string,
  raw: string | undefined,
): Promise<PolicyRevisionDetail | null> {
  if (!raw || raw === CURRENT_SENTINEL) return null
  const res = await fetchPolicyRevisionAction(raw)
  if (!res.ok) return null
  // Guard cross-policy revision links so a stale URL doesn't
  // silently render someone else's snapshot.
  if (res.data.policyId !== policyId) return null
  return res.data
}

export default async function PolicyComparePage({
  params,
  searchParams,
}: PolicyComparePageProps) {
  await requireAdmin()
  const { id } = await params
  const raw = await searchParams
  const scalar = (v: string | string[] | undefined) =>
    v === undefined ? undefined : Array.isArray(v) ? v[0] : v
  const fromRaw = scalar(raw.from)
  const toRaw = scalar(raw.to)

  const detailResult = await fetchPolicyDetailAction(id)
  if (!detailResult.ok) notFound()
  const { policy, revisions } = detailResult.data

  // Default picks: left = prior revision if any, right = current.
  // Keeps the "what changed between the last version and now" flow
  // one click away from the detail page.
  const priorRevisionId =
    revisions.find((r) => r.revision < policy.revision)?.id ??
    CURRENT_SENTINEL
  const effectiveFrom = fromRaw ?? priorRevisionId
  const effectiveTo = toRaw ?? CURRENT_SENTINEL

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
    />
  )
}
