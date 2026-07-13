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

interface NudgeEmailProps {
  name: string
  /** Admin-authored body copy. Displayed verbatim. */
  message: string
  /** If set, we frame the CTA as "Resume {course}"; otherwise Dashboard. */
  courseTitle: string | null
  ctaUrl: string
  branding?: Branding
}

export function NudgeEmail({
  name,
  message,
  courseTitle,
  ctaUrl,
  branding = DEFAULT_BRANDING,
}: NudgeEmailProps) {
  const s = emailStyles(branding)
  const preservedParagraph = { ...s.paragraph, whiteSpace: 'pre-wrap' as const }
  const preview = courseTitle
    ? `A quick nudge to keep going with ${courseTitle}`
    : 'A quick nudge to jump back in'
  const ctaLabel = courseTitle ? `Resume ${courseTitle}` : 'Open dashboard'

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <BrandHeader branding={branding} styles={s} />

          <Section style={s.content}>
            <Heading style={s.heading}>A quick nudge</Heading>
            <Text style={s.paragraph}>Hi {name},</Text>
            <Text style={preservedParagraph}>{message}</Text>

            <Section style={s.buttonSection}>
              <Button style={s.button} href={ctaUrl}>
                {ctaLabel}
              </Button>
            </Section>

            <Text style={s.paragraph}>
              {courseTitle
                ? `You're closer than you think — pick up right where you left off.`
                : `Open your dashboard and pick up where you left off.`}
            </Text>
          </Section>

          <BrandFooter branding={branding} styles={s} />
        </Container>
      </Body>
    </Html>
  )
}

export default NudgeEmail
