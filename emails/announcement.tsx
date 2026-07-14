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

interface AnnouncementEmailProps {
  title: string
  body: string
  viewUrl: string
  branding?: Branding
}

export function AnnouncementEmail({
  title,
  body,
  viewUrl,
  branding = DEFAULT_BRANDING,
}: AnnouncementEmailProps) {
  const s = emailStyles(branding)
  const announcementLabel = {
    color: branding.primaryColor,
    fontSize: '12px',
    fontWeight: 'bold' as const,
    letterSpacing: '0.1em',
    margin: '0 0 8px 0',
    textAlign: 'center' as const,
  }
  const compactHeading = { ...s.heading, fontSize: '24px' }
  const buttonSection = { ...s.buttonSection, margin: '32px 0 0 0' }
  const paragraph = { ...s.paragraph, lineHeight: '26px' }

  return (
    <Html>
      <Head />
      <Preview>{`New Announcement: ${title}`}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <BrandHeader branding={branding} styles={s} />

          <Section style={s.content}>
            <Text style={announcementLabel}>NEW ANNOUNCEMENT</Text>
            <Heading style={compactHeading}>{title}</Heading>
            <Text style={paragraph}>{body}</Text>

            <Section style={buttonSection}>
              <Button style={s.button} href={viewUrl}>
                View Full Announcement
              </Button>
            </Section>
          </Section>

          <BrandFooter branding={branding} styles={s} />
        </Container>
      </Body>
    </Html>
  )
}

export default AnnouncementEmail
