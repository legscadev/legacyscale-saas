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

interface PasswordResetEmailProps {
  name: string
  resetUrl: string
}

export function PasswordResetEmail({
  name,
  resetUrl,
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your Kondense password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logoText}>Kondense</Text>
          </Section>

          <Section style={content}>
            <Heading style={heading}>Reset Your Password</Heading>
            <Text style={paragraph}>Hi {name},</Text>
            <Text style={paragraph}>
              We received a request to reset your password. Click the button
              below to create a new password.
            </Text>

            <Section style={buttonSection}>
              <Button style={button} href={resetUrl}>
                Reset Password
              </Button>
            </Section>

            <Text style={paragraph}>
              This link is valid for 1 hour and is single-use — clicking it
              opens a secure form where you can choose your new password.
              If you didn&apos;t request a password reset, you can safely
              ignore this email.
            </Text>
            <Text style={paragraphSmall}>
              If the button doesn&apos;t work, copy and paste this link into
              your browser:
            </Text>
            <Text style={linkText}>
              <Link href={resetUrl} style={link}>
                {resetUrl}
              </Link>
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              Questions? Contact us at{' '}
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

export default PasswordResetEmail

// ─────────── styles ───────────

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
const paragraphSmall = {
  color: MUTED_FOOT,
  fontSize: '14px',
  lineHeight: '20px',
  margin: '24px 0 8px 0',
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
const linkText = { fontSize: '12px', wordBreak: 'break-all' as const }
