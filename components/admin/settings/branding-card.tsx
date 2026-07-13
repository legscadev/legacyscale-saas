'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import type { BrandingSaveResult } from '@/app/(admin)/admin/settings/branding-actions'
import {
  BORDER_RADIUS_VALUES,
  BUTTON_STYLE_VALUES,
  FONT_FAMILY_VALUES,
  type BorderRadius,
  type BrandingInput,
  type ButtonStyle,
  type FontFamily,
} from '@/lib/branding/schema'

interface BrandingCardProps {
  initial: BrandingInput | null
  action: (fd: FormData) => Promise<BrandingSaveResult>
}

// ────────────────────────────────────────────
// Local form state — one field per column in the Zod schema.
// Booleans + enums are kept as strings for the DOM, converted at
// submit time.
// ────────────────────────────────────────────

interface FormState {
  productName: string
  tagline: string
  supportEmail: string
  supportUrl: string
  fromName: string
  legalCompany: string
  privacyUrl: string
  termsUrl: string
  logoUrl: string
  logoDarkUrl: string
  faviconUrl: string
  ogImageUrl: string
  primaryColor: string
  accentColor: string
  backgroundColor: string
  sidebarBgColor: string
  destructiveColor: string
  fontFamily: FontFamily
  borderRadius: BorderRadius
  buttonStyle: ButtonStyle
  darkModeDefault: boolean
}

function initialState(initial: BrandingInput | null): FormState {
  return {
    productName: initial?.productName ?? '',
    tagline: initial?.tagline ?? '',
    supportEmail: initial?.supportEmail ?? '',
    supportUrl: initial?.supportUrl ?? '',
    fromName: initial?.fromName ?? '',
    legalCompany: initial?.legalCompany ?? '',
    privacyUrl: initial?.privacyUrl ?? '',
    termsUrl: initial?.termsUrl ?? '',
    logoUrl: initial?.logoUrl ?? '',
    logoDarkUrl: initial?.logoDarkUrl ?? '',
    faviconUrl: initial?.faviconUrl ?? '',
    ogImageUrl: initial?.ogImageUrl ?? '',
    primaryColor: initial?.primaryColor ?? '#d11a1a',
    accentColor: initial?.accentColor ?? '#f97316',
    backgroundColor: initial?.backgroundColor ?? '#0a0a0b',
    sidebarBgColor: initial?.sidebarBgColor ?? '#0a0a0a',
    destructiveColor: initial?.destructiveColor ?? '#ef4444',
    fontFamily: (initial?.fontFamily as FontFamily) ?? 'inter',
    borderRadius: (initial?.borderRadius as BorderRadius) ?? 'default',
    buttonStyle: (initial?.buttonStyle as ButtonStyle) ?? 'default',
    darkModeDefault: initial?.darkModeDefault ?? true,
  }
}

function buildFormData(state: FormState): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(state)) {
    if (typeof value === 'boolean') {
      if (value) fd.set(key, '1')
    } else if (value !== '' && value != null) {
      fd.set(key, String(value))
    }
  }
  return fd
}

export function BrandingCard({ initial, action }: BrandingCardProps) {
  const [state, setState] = useState<FormState>(initialState(initial))
  const [isSaving, startSaving] = useTransition()

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding &amp; theme</CardTitle>
        <CardDescription>
          Values here render across the app — sidebar, browser title,
          emails, PDFs. Colors + radius drive the theme when the tenant
          UI reads `--brand-*` variables.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* ── Form ── */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              startSaving(async () => {
                const result = await action(buildFormData(state))
                if (result.ok) toast.success('Branding saved')
                else toast.error(result.error ?? 'Could not save')
              })
            }}
            className="space-y-4"
          >
            <Tabs defaultValue="identity" className="gap-4">
              <TabsList>
                <TabsTrigger value="identity">Identity</TabsTrigger>
                <TabsTrigger value="logos">Logos</TabsTrigger>
                <TabsTrigger value="colors">Colors</TabsTrigger>
                <TabsTrigger value="typography">Typography</TabsTrigger>
                <TabsTrigger value="interface">Interface</TabsTrigger>
                <TabsTrigger value="legal">Legal</TabsTrigger>
              </TabsList>

              <TabsContent value="identity" className="space-y-4">
                <TextField
                  id="productName"
                  label="Product name"
                  value={state.productName}
                  onChange={(v) => update('productName', v)}
                  placeholder="Kondense"
                />
                <TextField
                  id="tagline"
                  label="Tagline"
                  value={state.tagline}
                  onChange={(v) => update('tagline', v)}
                  placeholder="Agency Education Platform"
                  hint="Used as browser-tab description + email preheader."
                />
                <TextField
                  id="supportEmail"
                  label="Support email"
                  type="email"
                  value={state.supportEmail}
                  onChange={(v) => update('supportEmail', v)}
                  placeholder="support@kondense.ai"
                />
                <TextField
                  id="supportUrl"
                  label="Support / help URL"
                  type="url"
                  value={state.supportUrl}
                  onChange={(v) => update('supportUrl', v)}
                  placeholder="https://help.example.com"
                />
                <TextField
                  id="fromName"
                  label="Email 'from' name"
                  value={state.fromName}
                  onChange={(v) => update('fromName', v)}
                  placeholder="Kondense"
                  hint="Sender name on transactional emails."
                />
                <TextField
                  id="legalCompany"
                  label="Legal company name"
                  value={state.legalCompany}
                  onChange={(v) => update('legalCompany', v)}
                  placeholder="Kondense"
                  hint="Renders in email footers + PDF certificates."
                />
              </TabsContent>

              <TabsContent value="logos" className="space-y-4">
                <TextField
                  id="logoUrl"
                  label="Logo URL"
                  type="url"
                  value={state.logoUrl}
                  onChange={(v) => update('logoUrl', v)}
                  placeholder="https://cdn.example.com/logo.png"
                />
                <TextField
                  id="logoDarkUrl"
                  label="Logo URL (dark mode)"
                  type="url"
                  value={state.logoDarkUrl}
                  onChange={(v) => update('logoDarkUrl', v)}
                  placeholder="https://cdn.example.com/logo-dark.png"
                  hint="Leave blank to reuse the light-mode logo."
                />
                <TextField
                  id="faviconUrl"
                  label="Favicon URL"
                  type="url"
                  value={state.faviconUrl}
                  onChange={(v) => update('faviconUrl', v)}
                  placeholder="https://cdn.example.com/favicon.ico"
                />
                <TextField
                  id="ogImageUrl"
                  label="Open Graph image URL"
                  type="url"
                  value={state.ogImageUrl}
                  onChange={(v) => update('ogImageUrl', v)}
                  placeholder="https://cdn.example.com/og.png"
                  hint="1200×630 recommended. Used in social share previews."
                />
              </TabsContent>

              <TabsContent value="colors" className="space-y-4">
                <ColorField
                  id="primaryColor"
                  label="Primary"
                  value={state.primaryColor}
                  onChange={(v) => update('primaryColor', v)}
                  hint="Wordmark accent, primary buttons, links."
                />
                <ColorField
                  id="accentColor"
                  label="Accent"
                  value={state.accentColor}
                  onChange={(v) => update('accentColor', v)}
                  hint="Secondary accent used for callouts and highlights."
                />
                <ColorField
                  id="backgroundColor"
                  label="Background"
                  value={state.backgroundColor}
                  onChange={(v) => update('backgroundColor', v)}
                  hint="Page background behind the main content."
                />
                <ColorField
                  id="sidebarBgColor"
                  label="Sidebar background"
                  value={state.sidebarBgColor}
                  onChange={(v) => update('sidebarBgColor', v)}
                  hint="Kept separate for classic dark-nav-light-content."
                />
                <ColorField
                  id="destructiveColor"
                  label="Destructive"
                  value={state.destructiveColor}
                  onChange={(v) => update('destructiveColor', v)}
                  hint="Delete / remove buttons + destructive-action accents."
                />
              </TabsContent>

              <TabsContent value="typography" className="space-y-4">
                <SelectField
                  id="fontFamily"
                  label="Font family"
                  value={state.fontFamily}
                  onChange={(v) => update('fontFamily', v as FontFamily)}
                  options={FONT_FAMILY_VALUES.map((v) => ({
                    value: v,
                    label:
                      v === 'inter'
                        ? 'Inter (modern sans-serif)'
                        : v === 'system'
                          ? 'System UI (native)'
                          : 'Serif (Georgia)',
                  }))}
                  hint="Applied via CSS variable — affects the whole shell."
                />
              </TabsContent>

              <TabsContent value="interface" className="space-y-4">
                <SelectField
                  id="borderRadius"
                  label="Border radius"
                  value={state.borderRadius}
                  onChange={(v) =>
                    update('borderRadius', v as BorderRadius)
                  }
                  options={BORDER_RADIUS_VALUES.map((v) => ({
                    value: v,
                    label: v[0].toUpperCase() + v.slice(1),
                  }))}
                  hint="Drives shadcn's --radius variable across cards + buttons + inputs."
                />
                <SelectField
                  id="buttonStyle"
                  label="Button shape"
                  value={state.buttonStyle}
                  onChange={(v) => update('buttonStyle', v as ButtonStyle)}
                  options={BUTTON_STYLE_VALUES.map((v) => ({
                    value: v,
                    label:
                      v === 'default'
                        ? 'Default (uses radius)'
                        : v === 'sharp'
                          ? 'Sharp corners'
                          : 'Pill (full-rounded)',
                  }))}
                />
                <ToggleField
                  id="darkModeDefault"
                  label="Dark mode by default"
                  checked={state.darkModeDefault}
                  onChange={(v) => update('darkModeDefault', v)}
                  hint="New visitors land on dark mode. They can still toggle."
                />
              </TabsContent>

              <TabsContent value="legal" className="space-y-4">
                <TextField
                  id="privacyUrl"
                  label="Privacy policy URL"
                  type="url"
                  value={state.privacyUrl}
                  onChange={(v) => update('privacyUrl', v)}
                  placeholder="https://example.com/privacy"
                />
                <TextField
                  id="termsUrl"
                  label="Terms of service URL"
                  type="url"
                  value={state.termsUrl}
                  onChange={(v) => update('termsUrl', v)}
                  placeholder="https://example.com/terms"
                />
              </TabsContent>
            </Tabs>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                Empty fields fall back to platform defaults.
              </span>
            </div>
          </form>

          {/* ── Live preview ── */}
          <ThemePreview state={state} />
        </div>
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────
// Field building blocks
// ────────────────────────────────────────────

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ColorField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          id={`${id}Swatch`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border bg-transparent"
          aria-label={`${label} color picker`}
        />
        <Input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          pattern="#[0-9a-fA-F]{6}"
          maxLength={7}
          className="max-w-[130px] font-mono uppercase"
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full max-w-[280px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-colors focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ToggleField({
  id,
  label,
  checked,
  onChange,
  hint,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        <Label htmlFor={id}>{label}</Label>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ────────────────────────────────────────────
// Live theme preview
// ────────────────────────────────────────────

function ThemePreview({ state }: { state: FormState }) {
  const radiusPx =
    state.borderRadius === 'sharp'
      ? '2px'
      : state.borderRadius === 'rounded'
        ? '18px'
        : '10px'
  const buttonRadius =
    state.buttonStyle === 'sharp'
      ? '2px'
      : state.buttonStyle === 'pill'
        ? '999px'
        : radiusPx
  const fontStack =
    state.fontFamily === 'serif'
      ? 'Georgia, ui-serif, serif'
      : state.fontFamily === 'system'
        ? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
        : 'var(--font-sans), -apple-system, sans-serif'
  const productLabel = state.productName || 'Kondense'

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Preview
      </div>
      <div
        style={{
          background: state.backgroundColor,
          borderRadius: radiusPx,
          fontFamily: fontStack,
          border: `1px solid ${state.backgroundColor}`,
        }}
        className="overflow-hidden shadow-sm"
      >
        {/* Sidebar strip */}
        <div
          style={{ background: state.sidebarBgColor }}
          className="flex items-center gap-2 px-3 py-3"
        >
          <span
            aria-hidden
            style={{ background: state.primaryColor, borderRadius: '4px' }}
            className="inline-block h-5 w-5"
          />
          <span
            style={{ color: '#fafafa' }}
            className="text-sm font-semibold tracking-tight"
          >
            {productLabel}
          </span>
        </div>
        {/* Content area */}
        <div style={{ background: state.backgroundColor }} className="space-y-3 p-4">
          <div
            style={{
              background: '#18181b',
              borderRadius: radiusPx,
              borderColor: '#27272a',
              borderWidth: 1,
              borderStyle: 'solid',
            }}
            className="space-y-2 p-4"
          >
            <div
              style={{ color: '#fafafa' }}
              className="text-sm font-semibold"
            >
              Sample card
            </div>
            <div style={{ color: '#a1a1aa' }} className="text-xs">
              Cards inherit the shell radius. Text uses the chosen font
              stack. Links{' '}
              <span style={{ color: state.accentColor }} className="underline">
                accent
              </span>{' '}
              stand out against the muted body.
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                style={{
                  background: state.primaryColor,
                  color: '#ffffff',
                  borderRadius: buttonRadius,
                }}
                className="px-3 py-1.5 text-xs font-semibold"
              >
                Get started
              </button>
              <button
                type="button"
                style={{
                  background: 'transparent',
                  color: state.accentColor,
                  border: `1px solid ${state.accentColor}`,
                  borderRadius: buttonRadius,
                }}
                className="px-3 py-1.5 text-xs font-semibold"
              >
                Learn more
              </button>
              <button
                type="button"
                style={{
                  background: state.destructiveColor,
                  color: '#ffffff',
                  borderRadius: buttonRadius,
                }}
                className="px-3 py-1.5 text-xs font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
          <div style={{ color: '#71717a' }} className="text-[10px]">
            font: {state.fontFamily} · radius: {state.borderRadius} ·
            button: {state.buttonStyle}
          </div>
        </div>
      </div>
    </div>
  )
}
