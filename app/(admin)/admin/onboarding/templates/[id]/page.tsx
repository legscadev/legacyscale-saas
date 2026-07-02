import { notFound } from 'next/navigation'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  checklistTemplateService,
  type TemplateDetail,
} from '@/lib/services/checklist-template-service'
import { TemplateEditor } from '@/components/admin/onboarding/template-editor'

export const metadata = {
  title: 'Template — Onboarding',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TemplateEditorPage({ params }: PageProps) {
  await requireAdmin()
  const { id } = await params

  let detail: TemplateDetail
  try {
    detail = await checklistTemplateService.get(id)
  } catch (err) {
    if (err instanceof Error && err.message === 'Template not found') {
      notFound()
    }
    throw err
  }
  return <TemplateEditor initialDetail={detail} />
}
