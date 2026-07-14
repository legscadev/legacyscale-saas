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

interface CompanyOwnerInviteEmailProps {
  /** Display name (or email-prefix fallback) for the new owner. */
  name: string
  /** Name of the tenant the recipient has been made owner of. */
  companyName: string
  /** Password-set + landing link. Points at /onboarding?token=… */
  ctaUrl: string
  /** Resolved platform branding — always the platform (Kondense)
   *  brand at send time, since the sub-tenant probably has no brand
   *  set yet. */
  branding?: Branding
}

/**
 * Sent when a super-admin creates a brand-new tenant and hands the
 * initial OWNER seat to a fresh (not-yet-registered) email. Distinct
 * from the regular WelcomeEmail invite variant so the copy can lean
 * on the "you now run a workspace" framing — regular member invites
 * are pitched as "come learn," these are pitched as "come manage."
 */
export function CompanyOwnerInviteEmail({
  name,
  companyName,
  ctaUrl,
  branding = DEFAULT_BRANDING,
}: CompanyOwnerInviteEmailProps) {
  const s = emailStyles(branding)

  return (
    <Html>
      <Head />
      <Preview>{`You're the owner of ${companyName} on ${branding.productName}`}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <BrandHeader branding={branding} styles={s} />

          <Section style={s.content}>
            <Heading style={s.heading}>
              Welcome to {branding.productName}, {name}
            </Heading>
            <Text style={s.paragraph}>
              You&apos;ve been set up as the owner of{' '}
              <strong>{companyName}</strong>. That means the full admin
              console is yours: courses, members, branding, and settings.
            </Text>
            <Text style={s.paragraph}>
              To get in, set your password using the button below. The
              link is valid for 7 days.
            </Text>

            <Section style={s.buttonSection}>
              <Button style={s.button} href={ctaUrl}>
                Set your password
              </Button>
            </Section>

            <Text style={s.paragraph}>
              Once you&apos;re in, a good first move is to brand the
              tenant (Admin → Settings → Branding) so members see{' '}
              {companyName} instead of the platform defaults.
            </Text>
          </Section>

          <BrandFooter branding={branding} styles={s} />
        </Container>
      </Body>
    </Html>
  )
}

export default CompanyOwnerInviteEmail
