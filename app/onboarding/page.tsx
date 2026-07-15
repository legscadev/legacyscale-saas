import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/layout/brand-mark'
import { prisma } from '@/lib/prisma'
import { PLATFORM_SEED_COMPANY_ID } from '@/lib/tenancy/seed'
import { AdminPasswordOnboarding } from './admin-password-onboarding'
import { OnboardingWizard } from './onboarding-wizard'

interface OnboardingPageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const { token } = await searchParams

  const invite = token
    ? await prisma.invite.findUnique({
        where: { token },
        include: {
          user: {
            select: { name: true, email: true, authId: true, role: true },
          },
        },
      })
    : null

  const isValid =
    !!invite &&
    !invite.usedAt &&
    invite.expiresAt > new Date() &&
    !!invite.user.authId

  if (isValid) {
    // Admins skip the marketing-style member wizard (welcome, profile,
    // goal, done) and go straight to password → dashboard. They're the
    // ones running the platform, not the ones being sold on it.
    if (invite.user.role === 'ADMIN') {
      // Company scope — populated for super/create-company invites so
      // the admin onboarding screen can name the tenant the recipient
      // is being handed. Regular admin invites resolve to the Kondense
      // seed row (or a deleted company), which we suppress since there
      // is no "You're the owner of Kondense" story to tell an internal
      // Kondense admin.
      const company = invite.companyId
        ? await prisma.company.findFirst({
            where: { id: invite.companyId, deletedAt: null },
            select: { id: true, name: true },
          })
        : null
      const companyName =
        company && company.id !== PLATFORM_SEED_COMPANY_ID
          ? company.name
          : null
      return (
        <AdminPasswordOnboarding token={token!} companyName={companyName} />
      )
    }
    const firstName = invite.user.name?.split(' ')[0] ?? null
    return (
      <OnboardingWizard
        token={token!}
        firstName={firstName}
        authId={invite.user.authId!}
      />
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <BrandMark />
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            Invite invalid
          </h1>
          <p className="text-sm text-muted-foreground">
            {invite?.usedAt
              ? 'This invite has already been used. Sign in with the password you set, or contact your admin.'
              : 'This invite link is invalid or has expired. Ask your admin to send a new one.'}
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full"
          render={<Link href="/login" />}
        >
          <ArrowLeft className="size-4" />
          Back to sign in
        </Button>
      </div>
    </main>
  )
}
