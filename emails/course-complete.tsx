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

interface CourseCompleteEmailProps {
  name: string
  courseTitle: string
  /** Link back to /courses/[slug]/complete so the member can revisit
   *  the celebration screen + see the next-course suggestion. */
  completeUrl: string
  branding?: Branding
}

export function CourseCompleteEmail({
  name,
  courseTitle,
  completeUrl,
  branding = DEFAULT_BRANDING,
}: CourseCompleteEmailProps) {
  const s = emailStyles(branding)
  const strong = { color: '#fafafa', fontWeight: 'bold' as const }

  return (
    <Html>
      <Head />
      <Preview>{`Congrats, ${name} — you finished ${courseTitle}!`}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <BrandHeader branding={branding} styles={s} />

          <Section style={s.content}>
            <Heading style={s.heading}>Course complete</Heading>
            <Text style={s.paragraph}>
              Nice work, {name}. You finished every lesson in{' '}
              <strong style={strong}>{courseTitle}</strong>.
            </Text>
            <Text style={s.paragraph}>
              Open your completion summary to revisit what you learned and
              see what we recommend next.
            </Text>

            <Section style={s.buttonSection}>
              <Button style={s.button} href={completeUrl}>
                View completion summary
              </Button>
            </Section>

            <Text style={s.paragraph}>
              You keep access to every chapter for as long as your enrollment
              allows — drop back in whenever you want a refresher.
            </Text>
          </Section>

          <BrandFooter branding={branding} styles={s} />
        </Container>
      </Body>
    </Html>
  )
}

export default CourseCompleteEmail
