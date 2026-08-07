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

interface LeadConfirmationEmailProps {
  leadName: string
  /** Program the lead applied to (shown in the copy + wordmark). */
  productName?: string
  branding?: Branding
}

export function LeadConfirmationEmail({
  leadName,
  productName = 'AI Agents Club',
  branding = DEFAULT_BRANDING,
}: LeadConfirmationEmailProps) {
  const s = emailStyles(branding)
  const firstName = (leadName || '').trim().split(/\s+/)[0] || 'there'

  return (
    <Html>
      <Head />
      <Preview>We got your application — a coach will reach out shortly</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <BrandHeader branding={branding} styles={s} />

          <Section style={s.content}>
            <Heading style={s.heading}>You&apos;re in! 🎉</Heading>
            <Text style={s.paragraph}>Hey {firstName},</Text>
            <Text style={s.paragraph}>
              Thanks for applying to {productName}. We&apos;ve received your
              details and a coach will reach out to you shortly — keep an eye on
              your phone and email.
            </Text>
            <Text style={s.paragraph}>
              Talk soon,
              <br />
              The {productName} Team
            </Text>
          </Section>

          <BrandFooter branding={branding} styles={s} />
        </Container>
      </Body>
    </Html>
  )
}

export default LeadConfirmationEmail
