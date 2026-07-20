import { notFound } from 'next/navigation'

import {
  fetchPolicyDetailAction,
  fetchPolicyWorkspaceAction,
} from '@/app/(admin)/admin/policies/actions'
import { PolicyEditor } from '@/components/admin/policies/policy-editor'
import { requireAdmin } from '@/lib/auth/get-user'

export const dynamic = 'force-dynamic'

interface PolicyEditPageProps {
  params: Promise<{ id: string }>
}

export default async function PolicyEditPage({
  params,
}: PolicyEditPageProps) {
  await requireAdmin()
  const { id } = await params

  // Fetch the detail payload + the category list from the workspace
  // fetcher in parallel. The workspace fetcher does other work
  // (seed guard, currentUserId) but the extra cost is small — one
  // COUNT + a categories query — and we get the seed guarantee.
  const [detailResult, workspaceResult] = await Promise.all([
    fetchPolicyDetailAction(id),
    fetchPolicyWorkspaceAction({ limit: 1 }),
  ])

  if (!detailResult.ok) notFound()
  if (!workspaceResult.ok) {
    throw new Error(workspaceResult.error ?? 'Could not load categories')
  }

  return (
    <PolicyEditor
      data={detailResult.data}
      categories={workspaceResult.data.categories}
    />
  )
}
