import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/auth/get-user'
import { orgBoardService } from '@/lib/services/org-board-service'
import { OrgNodeDrilldown } from '@/components/admin/org-board/org-node-drilldown'

export const metadata = {
  title: 'Org Board — Node',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrgBoardNodePage({ params }: PageProps) {
  await requireAdmin()
  const { id } = await params

  const result = await orgBoardService.getNodeWithSubtree(id)
  if (!result) notFound()

  return (
    <OrgNodeDrilldown
      revision={result.revision}
      node={result.node}
      ancestors={result.ancestors}
      subtree={result.subtree}
    />
  )
}
