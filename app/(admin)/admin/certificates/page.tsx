import { requireAdmin } from '@/lib/auth/get-user'
import { CertificatesShell } from '@/components/admin/certificates/certificates-shell'
import {
  fetchCertificates,
  listMembersForCertPicker,
  listModulesForCertPicker,
} from './actions'

export const dynamic = 'force-dynamic'

export default async function AdminCertificatesPage() {
  await requireAdmin()
  const [initialRows, members, modules] = await Promise.all([
    fetchCertificates({ status: 'all' }),
    listMembersForCertPicker(),
    listModulesForCertPicker(),
  ])

  return (
    <CertificatesShell
      initialRows={initialRows}
      members={members}
      modules={modules}
    />
  )
}
