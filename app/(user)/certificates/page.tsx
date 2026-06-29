import { Award } from 'lucide-react'

import { CertificatesList } from '@/components/member/certificates-list'
import { EmptyState, PageHeader } from '@/components/shared'
import { requireActiveUser } from '@/lib/auth'
import { listUserCertificates } from '@/lib/services/certificate-service'

export const dynamic = 'force-dynamic'

export default async function CertificatesPage() {
  const user = await requireActiveUser()
  const certificates = await listUserCertificates(user.id)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificates"
        description="Download a certificate for every module you've completed."
      />

      {certificates.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No certificates yet"
          description="Finish a module in any of your courses to earn your first certificate."
        />
      ) : (
        <CertificatesList items={certificates} />
      )}
    </div>
  )
}
