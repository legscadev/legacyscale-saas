import { requireAdmin } from '@/lib/auth/get-user'
import { orgBoardService } from '@/lib/services/org-board-service'
import { OrgBoardShell } from '@/components/admin/org-board/org-board-shell'

export const metadata = {
  title: 'Org Board — Admin',
}

interface PageProps {
  searchParams: Promise<{ revision?: string }>
}

export default async function OrgBoardAdminPage({ searchParams }: PageProps) {
  await requireAdmin()
  const { revision: revisionParam } = await searchParams

  const [revisions, requestedTree] = await Promise.all([
    orgBoardService.listRevisions(),
    revisionParam
      ? orgBoardService.getTreeForRevision(revisionParam)
      : orgBoardService.getCurrentTree(),
  ])

  const stats = requestedTree
    ? await orgBoardService.getStats(requestedTree.revision.id)
    : null
  const auditLogs = requestedTree
    ? await orgBoardService.listAuditLogs(requestedTree.revision.id, 20)
    : []

  return (
    <OrgBoardShell
      tree={requestedTree}
      revisions={revisions}
      stats={stats}
      auditLogs={auditLogs}
    />
  )
}
