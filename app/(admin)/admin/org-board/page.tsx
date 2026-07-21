import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { orgBoardService } from '@/lib/services/org-board-service'
import { OrgBoardShell } from '@/components/admin/org-board/org-board-shell'

export const metadata = {
  title: 'Org Board — Admin',
}

interface PageProps {
  searchParams: Promise<{ revision?: string }>
}

export default async function OrgBoardAdminPage({ searchParams }: PageProps) {
  await requireTeamModuleAccess('org-board')
  const { revision: revisionParam } = await searchParams

  const [revisions, requestedTree] = await Promise.all([
    orgBoardService.listRevisions(),
    revisionParam
      ? orgBoardService.getTreeForRevision(revisionParam)
      : orgBoardService.getCurrentTree(),
  ])

  const auditLogs = requestedTree
    ? await orgBoardService.listAuditLogs(requestedTree.revision.id, 20)
    : []

  return (
    <OrgBoardShell
      tree={requestedTree}
      revisions={revisions}
      auditLogs={auditLogs}
    />
  )
}
