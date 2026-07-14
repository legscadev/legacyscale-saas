// Shared branding fragments + style factory for React Email templates.
//
// Every template renders the same top-of-email wordmark and bottom-of-
// email footer — this module keeps that markup in one place so a
// branding change (color / product name / support email) reaches every
// template on the next render. Style objects are functions of the
// resolved Branding, not module-level constants, so tenants that
// override `primaryColor` see the accent color propagate to the
// wordmark + button + link everywhere.
//
// Templates should never hardcode "Kondense" or `#d11a1a` again — pull
// from the branding argument instead.

import { Link, Section, Text } from '@react-email/components'

import type { Branding } from '@/lib/branding/schema'

// ────────────────────────────────────────────
// Style factory
// ────────────────────────────────────────────

// Dark app-shell palette matches the in-app theme. Only the accent
// varies per tenant.
const BG = '#0a0a0b'
const CARD = '#18181b'
const BORDER = '#27272a'
const FG = '#fafafa'
const MUTED = '#a1a1aa'
const MUTED_FOOT = '#71717a'

export function emailStyles(branding: Branding) {
  const brand = branding.primaryColor

  return {
    main: {
      backgroundColor: BG,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    container: { margin: '0 auto', padding: '40px 20px', maxWidth: '560px' },
    logoSection: { textAlign: 'center' as const, marginBottom: '32px' },
    logoText: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: brand,
      margin: '0',
    },
    content: {
      backgroundColor: CARD,
      borderRadius: '12px',
      padding: '40px 32px',
      border: `1px solid ${BORDER}`,
    },
    heading: {
      color: FG,
      fontSize: '28px',
      fontWeight: 'bold',
      margin: '0 0 24px 0',
      textAlign: 'center' as const,
    },
    paragraph: {
      color: MUTED,
      fontSize: '16px',
      lineHeight: '24px',
      margin: '0 0 16px 0',
    },
    buttonSection: { textAlign: 'center' as const, margin: '32px 0' },
    button: {
      backgroundColor: brand,
      borderRadius: '8px',
      color: '#ffffff',
      display: 'inline-block',
      fontSize: '16px',
      fontWeight: 'bold',
      padding: '14px 28px',
      textDecoration: 'none',
    },
    list: {
      color: MUTED,
      fontSize: '16px',
      lineHeight: '24px',
      margin: '0 0 16px 0',
      paddingLeft: '24px',
    },
    listItem: { marginBottom: '8px' },
    footer: { textAlign: 'center' as const, marginTop: '32px' },
    footerText: {
      color: MUTED_FOOT,
      fontSize: '12px',
      lineHeight: '20px',
      margin: '0 0 8px 0',
    },
    link: { color: brand, textDecoration: 'underline' },
    label: {
      color: MUTED_FOOT,
      fontSize: '11px',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.08em',
      margin: '0 0 8px 0',
    },
    infoBlock: {
      backgroundColor: '#111114',
      borderRadius: '8px',
      padding: '16px 20px',
      margin: '20px 0',
      border: `1px solid ${BORDER}`,
    },
  }
}

export type EmailStyles = ReturnType<typeof emailStyles>

// ────────────────────────────────────────────
// Shared markup
// ────────────────────────────────────────────

export function BrandHeader({
  branding,
  styles,
}: {
  branding: Branding
  styles: EmailStyles
}) {
  return (
    <Section style={styles.logoSection}>
      <Text style={styles.logoText}>{branding.productName}</Text>
    </Section>
  )
}

export function BrandFooter({
  branding,
  styles,
}: {
  branding: Branding
  styles: EmailStyles
}) {
  return (
    <Section style={styles.footer}>
      <Text style={styles.footerText}>
        Questions? Reply to this email or contact us at{' '}
        <Link href={`mailto:${branding.supportEmail}`} style={styles.link}>
          {branding.supportEmail}
        </Link>
      </Text>
      <Text style={styles.footerText}>
        © {new Date().getFullYear()} {branding.legalCompany}. All rights
        reserved.
      </Text>
    </Section>
  )
}
