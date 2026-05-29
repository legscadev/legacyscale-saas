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

interface AnnouncementEmailProps {
  title: string
  body: string
  viewUrl: string
}

export function AnnouncementEmail({
  title,
  body,
  viewUrl,
}: AnnouncementEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`New Announcement: ${title}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logoText}>Legacy Scale</Text>
          </Section>

          <Section style={content}>
            <Text style={announcementLabel}>NEW ANNOUNCEMENT</Text>
            <Heading style={heading}>{title}</Heading>
            <Text style={paragraph}>{body}</Text>

            <Section style={buttonSection}>
              <Button style={button} href={viewUrl}>
                View Full Announcement
              </Button>
            </Section>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              You received this email because you&apos;re a Legacy Scale
              member.
            </Text>
            <Text style={footerText}>
              © {new Date().getFullYear()} Legacy Scale. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default AnnouncementEmail

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
const announcementLabel = {
  color: BRAND,
  fontSize: '12px',
  fontWeight: 'bold',
  letterSpacing: '0.1em',
  margin: '0 0 8px 0',
  textAlign: 'center' as const,
}
const heading = {
  color: FG,
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 24px 0',
  textAlign: 'center' as const,
}
const paragraph = {
  color: MUTED,
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px 0',
}
const buttonSection = { textAlign: 'center' as const, margin: '32px 0 0 0' }
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
