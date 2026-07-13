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

interface WelcomeEmailProps {
  name: string
  /** Where the primary CTA points. */
  ctaUrl: string
  /** Variant: invite emails surface a password-set CTA; returning users
   *  (post-onboarding) get the dashboard link. */
  variant?: 'invite' | 'dashboard'
  /** Resolved tenant branding — defaults to platform (Kondense). */
  branding?: Branding
}

export function WelcomeEmail({
  name,
  ctaUrl,
  variant = 'dashboard',
  branding = DEFAULT_BRANDING,
}: WelcomeEmailProps) {
  const s = emailStyles(branding)
  const isInvite = variant === 'invite'
  const ctaLabel = isInvite ? "Let's Get Started" : 'Access your dashboard'

  return (
    <Html>
      <Head />
      <Preview>{`Welcome to ${branding.productName}, ${name}!`}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <BrandHeader branding={branding} styles={s} />

          <Section style={s.content}>
            <Heading style={s.heading}>Welcome, {name}!</Heading>
            <Text style={s.paragraph}>
              You&apos;re now part of the {branding.productName} community.
              We&apos;re excited to have you on board and can&apos;t wait to
              see you succeed.
            </Text>
            {isInvite ? (
              <Text style={s.paragraph}>
                Your account is ready — click the link below to finish
                setting it up. The link is valid for 7 days.
              </Text>
            ) : (
              <Text style={s.paragraph}>
                Access your courses, connect with the community, and start
                learning today.
              </Text>
            )}

            <Section style={s.buttonSection}>
              <Button style={s.button} href={ctaUrl}>
                {ctaLabel}
              </Button>
            </Section>

            {!isInvite && (
              <>
                <Text style={s.paragraph}>
                  Here&apos;s what you can do next:
                </Text>
                <ul style={s.list}>
                  <li style={s.listItem}>Complete your profile</li>
                  <li style={s.listItem}>Browse available courses</li>
                  <li style={s.listItem}>Check out the latest announcements</li>
                </ul>
              </>
            )}
          </Section>

          <BrandFooter branding={branding} styles={s} />
        </Container>
      </Body>
    </Html>
  )
}

export default WelcomeEmail
