import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface CertificateDeliveryEmailProps {
  name: string
  moduleTitle: string
  courseTitle: string
  shortCode: string
}

export function CertificateDeliveryEmail({
  name,
  moduleTitle,
  courseTitle,
  shortCode,
}: CertificateDeliveryEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Your certificate for ${moduleTitle}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logoText}>Kondense</Text>
          </Section>

          <Section style={content}>
            <Heading style={heading}>Your certificate is attached</Heading>
            <Text style={paragraph}>
              Hi {name} — here&apos;s your certificate for{' '}
              <strong style={strong}>{moduleTitle}</strong> (part of{' '}
              <strong style={strong}>{courseTitle}</strong>).
            </Text>
            <Text style={paragraph}>
              The PDF is attached to this email. Certificate ID:{' '}
              <span style={mono}>{shortCode}</span>.
            </Text>
            <Text style={paragraph}>
              You can also re-download it any time from the{' '}
              <strong style={strong}>Certificates</strong> tab in your account.
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

export default CertificateDeliveryEmail

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
}
const strong = { color: FG, fontWeight: 'bold' as const }
const mono = { color: FG, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }
const footer = { textAlign: 'center' as const, marginTop: '32px' }
const footerText = {
  color: MUTED_FOOT,
  fontSize: '12px',
  lineHeight: '20px',
  margin: '0 0 8px 0',
}
const link = { color: BRAND, textDecoration: 'underline' }
