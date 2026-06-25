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

interface CourseCompleteEmailProps {
  name: string
  courseTitle: string
  /** Link back to /courses/[slug]/complete so the member can revisit
   *  the celebration screen + see the next-course suggestion. */
  completeUrl: string
}

export function CourseCompleteEmail({
  name,
  courseTitle,
  completeUrl,
}: CourseCompleteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Congrats, ${name} — you finished ${courseTitle}!`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logoText}>Kondense</Text>
          </Section>

          <Section style={content}>
            <Heading style={heading}>Course complete</Heading>
            <Text style={paragraph}>
              Nice work, {name}. You finished every lesson in{' '}
              <strong style={strong}>{courseTitle}</strong>.
            </Text>
            <Text style={paragraph}>
              Open your completion summary to revisit what you learned and
              see what we recommend next.
            </Text>

            <Section style={buttonSection}>
              <Button style={button} href={completeUrl}>
                View completion summary
              </Button>
            </Section>

            <Text style={paragraph}>
              You keep access to every chapter for as long as your enrollment
              allows — drop back in whenever you want a refresher.
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

export default CourseCompleteEmail

// ─────────── styles (red brand, dark theme — matches welcome.tsx) ───────────

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

const strong = { color: FG, fontWeight: 'bold' as const }

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
