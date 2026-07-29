import { redirect } from 'next/navigation'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import { PipelineShell } from '@/components/admin/crm/pipeline-shell'
import { fetchPipelineWorkspaceAction } from '@/app/(admin)/admin/crm/opportunities/actions'

// TEAM (setter/closer) surface for the CRM opportunities board. Mirrors
// /admin/crm/opportunities — same shell, same action — under a /team/*
// URL so staff URLs stay separate from admin URLs. ADMIN gets bounced
// to the admin surface. The action gates on the crm-pipeline module
// grant, so only TEAM users who hold it get here.

export const dynamic = 'force-dynamic'

interface TeamPipelinePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TeamPipelinePage({
  searchParams,
}: TeamPipelinePageProps) {
  const viewer = await requireTeamModuleAccess('crm-pipeline')
  if (viewer.role === 'ADMIN') redirect('/admin/crm/opportunities')

  const raw = await searchParams
  const pipelineId = Array.isArray(raw.pipeline) ? raw.pipeline[0] : raw.pipeline

  const result = await fetchPipelineWorkspaceAction({ pipelineId })
  if (!result.ok) {
    if (result.fieldErrors) redirect('/team/crm/opportunities')
    throw new Error(result.error ?? 'Could not load pipeline')
  }

  return (
    <PipelineShell
      initialData={result.data}
      basePath="/team/crm/opportunities"
    />
  )
}
