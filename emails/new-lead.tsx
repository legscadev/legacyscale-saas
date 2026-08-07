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

export interface NewLeadAnswer {
  label: string
  value: string
}

interface NewLeadEmailProps {
  /** The funnel owner being notified (e.g. "Keanu"). */
  recipientName: string
  leadName: string
  leadEmail?: string | null
  leadPhone?: string | null
  /** Where the lead came from, e.g. "AI Agents Club — Keanu". */
  source?: string | null
  /** Qualifying answers, already flattened to label/value pairs. */
  answers?: NewLeadAnswer[]
  /** Deep link into the CRM opportunity/pipeline. */
  ctaUrl: string
  branding?: Branding
}

export function NewLeadEmail({
  recipientName,
  leadName,
  leadEmail,
  leadPhone,
  source,
  answers = [],
  ctaUrl,
  branding = DEFAULT_BRANDING,
}: NewLeadEmailProps) {
  const s = emailStyles(branding)
  const rowLabel = { ...s.label, margin: '0' }
  const rowValue = { ...s.paragraph, color: '#fafafa', margin: '0 0 14px 0' }
  const lastRowValue = { ...rowValue, margin: '0' }

  return (
    <Html>
      <Head />
      <Preview>New application from {leadName}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <BrandHeader branding={branding} styles={s} />

          <Section style={s.content}>
            <Heading style={s.heading}>New lead 🎯</Heading>
            <Text style={s.paragraph}>
              Hi {recipientName}, a new application just came in
              {source ? ` from ${source}` : ''}.
            </Text>

            <Section style={s.infoBlock}>
              <Text style={rowLabel}>Name</Text>
              <Text style={rowValue}>{leadName}</Text>
              <Text style={rowLabel}>Phone</Text>
              <Text style={rowValue}>{leadPhone || '—'}</Text>
              <Text style={rowLabel}>Email</Text>
              <Text style={lastRowValue}>{leadEmail || '—'}</Text>
            </Section>

            {answers.length > 0 && (
              <Section style={s.infoBlock}>
                {answers.map((a, i) => (
                  <Section key={i}>
                    <Text style={rowLabel}>{a.label}</Text>
                    <Text
                      style={i === answers.length - 1 ? lastRowValue : rowValue}
                    >
                      {a.value}
                    </Text>
                  </Section>
                ))}
              </Section>
            )}

            <Section style={s.buttonSection}>
              <Button style={s.button} href={ctaUrl}>
                View in CRM
              </Button>
            </Section>

            <Text style={s.paragraph}>
              Reach out fast — speed-to-lead wins deals.
            </Text>
          </Section>

          <BrandFooter branding={branding} styles={s} />
        </Container>
      </Body>
    </Html>
  )
}

export default NewLeadEmail
