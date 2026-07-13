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

import { DEFAULT_BRANDING } from '@/lib/branding/defaults'
import type { Branding } from '@/lib/branding/schema'

import { BrandFooter, BrandHeader, emailStyles } from './_brand'

interface PasswordResetEmailProps {
  name: string
  resetUrl: string
  branding?: Branding
}

export function PasswordResetEmail({
  name,
  resetUrl,
  branding = DEFAULT_BRANDING,
}: PasswordResetEmailProps) {
  const s = emailStyles(branding)
  const paragraphSmall = {
    color: '#71717a',
    fontSize: '14px',
    lineHeight: '20px',
    margin: '24px 0 8px 0',
  }
  const linkText = { fontSize: '12px', wordBreak: 'break-all' as const }

  return (
    <Html>
      <Head />
      <Preview>{`Reset your ${branding.productName} password`}</Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          <BrandHeader branding={branding} styles={s} />

          <Section style={s.content}>
            <Heading style={s.heading}>Reset Your Password</Heading>
            <Text style={s.paragraph}>Hi {name},</Text>
            <Text style={s.paragraph}>
              We received a request to reset your password. Click the button
              below to create a new password.
            </Text>

            <Section style={s.buttonSection}>
              <Button style={s.button} href={resetUrl}>
                Reset Password
              </Button>
            </Section>

            <Text style={s.paragraph}>
              This link is valid for 1 hour and is single-use — clicking it
              opens a secure form where you can choose your new password. If
              you didn&apos;t request a password reset, you can safely
              ignore this email.
            </Text>
            <Text style={paragraphSmall}>
              If the button doesn&apos;t work, copy and paste this link into
              your browser:
            </Text>
            <Text style={linkText}>
              <Link href={resetUrl} style={s.link}>
                {resetUrl}
              </Link>
            </Text>
          </Section>

          <BrandFooter branding={branding} styles={s} />
        </Container>
      </Body>
    </Html>
  )
}

export default PasswordResetEmail
