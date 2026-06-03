import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/layout/brand-mark'
import { prisma } from '@/lib/prisma'
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
        include: { user: { select: { name: true, email: true, authId: true } } },
      })
    : null

  const isValid =
    !!invite &&
    !invite.usedAt &&
    invite.expiresAt > new Date() &&
    !!invite.user.authId

  if (isValid) {
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
