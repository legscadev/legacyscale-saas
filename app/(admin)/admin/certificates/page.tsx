import { requireAdmin } from '@/lib/auth/get-user'
import { CertificatesShell } from '@/components/admin/certificates/certificates-shell'
import {
  fetchCertificates,
  listCoursesForCertPicker,
  listMembersForCertPicker,
} from './actions'

export const dynamic = 'force-dynamic'

export default async function AdminCertificatesPage() {
  await requireAdmin()
  const [initialRows, members, courses] = await Promise.all([
    fetchCertificates({ status: 'all' }),
    listMembersForCertPicker(),
    listCoursesForCertPicker(),
  ])

  return (
    <CertificatesShell
      initialRows={initialRows}
      members={members}
      courses={courses}
    />
  )
}
