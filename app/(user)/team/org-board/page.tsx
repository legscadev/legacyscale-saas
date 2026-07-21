import { redirect } from 'next/navigation'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { orgBoardService } from '@/lib/services/org-board-service'
import { OrgBoardShell } from '@/components/admin/org-board/org-board-shell'

// TEAM-side wrapper for the Organization Board. ADMIN gets
// bounced to /admin/org-board.

export const metadata = {
  title: 'Org Board',
}

interface PageProps {
  searchParams: Promise<{ revision?: string }>
}

export default async function TeamOrgBoardPage({ searchParams }: PageProps) {
  const viewer = await requireTeamModuleAccess('org-board')
  if (viewer.role === 'ADMIN') redirect('/admin/org-board')

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
