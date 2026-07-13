import {
  Body,
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

interface CertificateDeliveryEmailProps {
  name: string
  moduleTitle: string
  courseTitle: string
  shortCode: string
  branding?: Branding
}

export function CertificateDeliveryEmail({
  name,
  moduleTitle,
  courseTitle,
  shortCode,
  branding = DEFAULT_BRANDING,
}: CertificateDeliveryEmailProps) {
  const s = emailStyles(branding)
  const strong = { color: '#fafafa', fontWeight: 'bold' as const }
  const mono = {
    color: '#fafafa',
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  }

  return (
    <Html>
      <Head />
      <Preview>{`Your certificate for ${moduleTitle}`}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <BrandHeader branding={branding} styles={s} />

          <Section style={s.content}>
            <Heading style={s.heading}>Your certificate is attached</Heading>
            <Text style={s.paragraph}>
              Hi {name} — here&apos;s your certificate for{' '}
              <strong style={strong}>{moduleTitle}</strong> (part of{' '}
              <strong style={strong}>{courseTitle}</strong>).
            </Text>
            <Text style={s.paragraph}>
              The PDF is attached to this email. Certificate ID:{' '}
              <span style={mono}>{shortCode}</span>.
            </Text>
            <Text style={s.paragraph}>
              You can also re-download it any time from the{' '}
              <strong style={strong}>Certificates</strong> tab in your
              account.
            </Text>
          </Section>

          <BrandFooter branding={branding} styles={s} />
        </Container>
      </Body>
    </Html>
  )
}

export default CertificateDeliveryEmail
