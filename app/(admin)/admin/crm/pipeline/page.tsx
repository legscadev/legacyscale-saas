import { redirect } from 'next/navigation'

import { requireTeamOrAdmin } from '@/lib/auth/get-user'
import { PipelineShell } from '@/components/admin/crm/pipeline-shell'

import { fetchPipelineWorkspaceAction } from './actions'

// Admin surface for the CRM pipeline. TEAM users have their own view
// at /team/crm/pipeline — bounce them there with query params intact
// so inbound /admin/crm links still land somewhere useful. ADMIN sees
// every deal in the tenant.

export const dynamic = 'force-dynamic'

interface AdminPipelinePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminPipelinePage({
  searchParams,
}: AdminPipelinePageProps) {
  const viewer = await requireTeamOrAdmin()
  const raw = await searchParams
  if (viewer.role !== 'ADMIN') {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(raw)) {
      if (value === undefined) continue
      if (Array.isArray(value)) value.forEach((v) => qs.append(key, v))
      else qs.set(key, value)
    }
    const suffix = qs.toString()
    redirect(suffix ? `/team/crm/pipeline?${suffix}` : '/team/crm/pipeline')
  }

  const pipelineId = Array.isArray(raw.pipeline) ? raw.pipeline[0] : raw.pipeline
  const result = await fetchPipelineWorkspaceAction({ pipelineId })
  if (!result.ok) {
    if (result.fieldErrors) redirect('/admin/crm/pipeline')
    throw new Error(result.error ?? 'Could not load pipeline')
  }

  return (
    <PipelineShell initialData={result.data} basePath="/admin/crm/pipeline" />
  )
}
