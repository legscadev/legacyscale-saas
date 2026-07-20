import { notFound } from 'next/navigation'

import { fetchPolicyDetailAction } from '@/app/(admin)/admin/policies/actions'
import { PolicyDetailView } from '@/components/admin/policies/policy-detail-view'
import { requireAdmin } from '@/lib/auth/get-user'

export const dynamic = 'force-dynamic'

interface PolicyDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function PolicyDetailPage({
  params,
}: PolicyDetailPageProps) {
  await requireAdmin()
  const { id } = await params

  const result = await fetchPolicyDetailAction(id)
  if (!result.ok) {
    // Not-found + forbidden both surface as notFound() — the detail
    // page shouldn't leak whether a UUID belongs to another tenant.
    notFound()
  }

  return <PolicyDetailView data={result.data} />
}
