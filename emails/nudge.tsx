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

interface NudgeEmailProps {
  name: string
  /** Admin-authored body copy. Displayed verbatim. */
  message: string
  /** If set, we frame the CTA as "Resume {course}"; otherwise Dashboard. */
  courseTitle: string | null
  ctaUrl: string
}

export function NudgeEmail({
  name,
  message,
  courseTitle,
  ctaUrl,
}: NudgeEmailProps) {
  const preview = courseTitle
    ? `A quick nudge to keep going with ${courseTitle}`
    : 'A quick nudge to jump back in'
  const ctaLabel = courseTitle ? `Resume ${courseTitle}` : 'Open dashboard'

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logoText}>Kondense</Text>
          </Section>

          <Section style={content}>
            <Heading style={heading}>A quick nudge</Heading>
            <Text style={paragraph}>Hi {name},</Text>
            <Text style={paragraph}>{message}</Text>

            <Section style={buttonSection}>
              <Button style={button} href={ctaUrl}>
                {ctaLabel}
              </Button>
            </Section>

            <Text style={paragraph}>
              {courseTitle
                ? `You're closer than you think — pick up right where you left off.`
                : `Open your dashboard and pick up where you left off.`}
            </Text>
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

export default NudgeEmail

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
const container = { margin: '0 auto', padding: '40px 20px', maxWidth: '560px' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px' }
const logoText = { fontSize: '24px', fontWeight: 'bold', color: BRAND, margin: '0' }
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
  whiteSpace: 'pre-wrap' as const,
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
const footer = { textAlign: 'center' as const, marginTop: '32px' }
const footerText = {
  color: MUTED_FOOT,
  fontSize: '12px',
  lineHeight: '20px',
  margin: '0 0 8px 0',
}
const link = { color: BRAND, textDecoration: 'underline' }
