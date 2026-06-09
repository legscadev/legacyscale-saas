import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface WelcomeEmailProps {
  name: string
  /** Where the primary CTA points. */
  ctaUrl: string
  /** Variant: invite emails surface a password-set CTA; returning users
   *  (post-onboarding) get the dashboard link. */
  variant?: 'invite' | 'dashboard'
}

export function WelcomeEmail({
  name,
  ctaUrl,
  variant = 'dashboard',
}: WelcomeEmailProps) {
  const isInvite = variant === 'invite'
  const ctaLabel = isInvite ? "Let's Get Started" : 'Access your dashboard'

  return (
    <Html>
      <Head />
      <Preview>{`Welcome to Kondense, ${name}!`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logoText}>Kondense</Text>
          </Section>

          <Section style={content}>
            <Heading style={heading}>Welcome, {name}!</Heading>
            <Text style={paragraph}>
              You&apos;re now part of the Kondense community. We&apos;re
              excited to have you on board and can&apos;t wait to see you
              succeed.
            </Text>
            {isInvite ? (
              <Text style={paragraph}>
                Your account is ready — click the link below to finish setting
                it up. The link is valid for 7 days.
              </Text>
            ) : (
              <Text style={paragraph}>
                Your journey to building a 7-figure agency starts now. Access
                your courses, connect with the community, and start learning
                today.
              </Text>
            )}

            <Section style={buttonSection}>
              <Button style={button} href={ctaUrl}>
                {ctaLabel}
              </Button>
            </Section>

            {!isInvite && (
              <>
                <Text style={paragraph}>
                  Here&apos;s what you can do next:
                </Text>
                <ul style={list}>
                  <li style={listItem}>Complete your profile</li>
                  <li style={listItem}>Browse available courses</li>
                  <li style={listItem}>Start the 7-Figure Agency Program</li>
                  <li style={listItem}>Check out the latest announcements</li>
                </ul>
              </>
            )}
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              Questions? Reply to this email or contact us at{' '}
              <Link href="mailto:support@kondense.ai" style={link}>
                support@kondense.ai
              </Link>
            </Text>
            <Text style={footerText}>
              © {new Date().getFullYear()} Kondense. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default WelcomeEmail

// ─────────── styles (red brand, dark theme) ───────────

const BRAND = '#d11a1a'
const BG = '#0a0a0b'
const CARD = '#18181b'
const BORDER = '#27272a'
const FG = '#fafafa'
const MUTED = '#a1a1aa'
const MUTED_FOOT = '#71717a'

const main = {
  backgroundColor: BG,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container = {
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '560px',
}

const logoSection = { textAlign: 'center' as const, marginBottom: '32px' }
const logoText = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: BRAND,
  margin: '0',
}

const content = {
  backgroundColor: CARD,
  borderRadius: '12px',
  padding: '40px 32px',
  border: `1px solid ${BORDER}`,
}

const heading = {
  color: FG,
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0 0 24px 0',
  textAlign: 'center' as const,
}

const paragraph = {
  color: MUTED,
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px 0',
}

const buttonSection = { textAlign: 'center' as const, margin: '32px 0' }

const button = {
  backgroundColor: BRAND,
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: 'bold',
  padding: '14px 28px',
  textDecoration: 'none',
}

const list = {
  color: MUTED,
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px 0',
  paddingLeft: '24px',
}

const listItem = { marginBottom: '8px' }

const footer = { textAlign: 'center' as const, marginTop: '32px' }

const footerText = {
  color: MUTED_FOOT,
  fontSize: '12px',
  lineHeight: '20px',
  margin: '0 0 8px 0',
}

const link = { color: BRAND, textDecoration: 'underline' }
