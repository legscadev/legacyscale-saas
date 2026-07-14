import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import { DEFAULT_BRANDING } from '@/lib/branding/defaults'
import type { Branding } from '@/lib/branding/schema'

import { BrandFooter, BrandHeader, emailStyles } from './_brand'

interface OwnerAddedEmailProps {
  /** Display name (or email-prefix fallback) for the recipient. */
  name: string
  /** Company they were just made OWNER of. */
  companyName: string
  /** Deep-link straight to that tenant's admin dashboard. Callers
   *  build this by resolving `NEXT_PUBLIC_APP_URL + /admin/dashboard`;
   *  the switch happens once the recipient signs in and picks the
   *  tenant, so the URL is more of a "get there" pointer than a
   *  single-use magic link. */
  ctaUrl: string
  /** True when the recipient is a super-admin and the assignment
   *  doesn't actually change their access — just formalises them as
   *  OWNER on paper. Softens the copy so they don't think this is
   *  new capability. */
  isSuperAdmin?: boolean
  /** True when the recipient was promoted from MEMBER/TEAM to ADMIN
   *  as part of the assignment. Tells them they now have admin
   *  console access they didn't before. */
  wasPromoted?: boolean
  /** Resolved platform branding. */
  branding?: Branding
}

/**
 * Sent by super/create-company when an EXISTING user is attached as
 * OWNER of a new tenant. Distinct from CompanyOwnerInviteEmail:
 *   - No password-set link (they already have an account)
 *   - Copy leans on "we recorded you as OWNER" / "your admin console
 *     for {name} is here" instead of onboarding-marketing framing
 */
export function OwnerAddedEmail({
  name,
  companyName,
  ctaUrl,
  isSuperAdmin = false,
  wasPromoted = false,
  branding = DEFAULT_BRANDING,
}: OwnerAddedEmailProps) {
  const s = emailStyles(branding)
  const headsUp = isSuperAdmin
    ? `You now formally own ${companyName} on ${branding.productName}. Since you're a super-admin, this doesn't change your access — you could already enter every tenant. This email exists so you know you're on the paper trail.`
    : wasPromoted
      ? `You've been added as the owner of ${companyName} on ${branding.productName}. Your platform account was promoted to admin so you can open its console below.`
      : `You've been added as the owner of ${companyName} on ${branding.productName}. Sign in with your existing password and pick the tenant from the switcher to open its admin console.`

  return (
    <Html>
      <Head />
      <Preview>{`Your ${branding.productName} workspace is ready — sign in to open ${companyName}.`}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <BrandHeader branding={branding} styles={s} />

          <Section style={s.content}>
            <Heading style={s.heading}>
              Hi {name}, quick heads-up
            </Heading>
            <Text style={s.paragraph}>{headsUp}</Text>

            <Section style={s.buttonSection}>
              <Button style={s.button} href={ctaUrl}>
                Open {companyName}
              </Button>
            </Section>
          </Section>

          <BrandFooter branding={branding} styles={s} />
        </Container>
      </Body>
    </Html>
  )
}

export default OwnerAddedEmail
