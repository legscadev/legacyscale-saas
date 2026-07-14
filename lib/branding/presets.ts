// Named theme presets.
//
// A preset is a "visual only" snapshot — colors, typography, and
// UI knobs. Identity fields (productName, tagline, logos, emails,
// legal URLs) stay tenant-specific and are never touched by a
// preset apply.
//
// Adding a new preset: append to `THEME_PRESETS` below. The UI
// (BrandingCard) reads that list at render time so no other file
// needs changes.

import type { BorderRadius, BrandingInput, ButtonStyle, FontFamily } from './schema'

/** The visual-only slice of a Branding. Presets fill exactly these
 *  keys — anything not present here stays tenant-specific. */
export type ThemeShape = Pick<
  BrandingInput,
  | 'primaryColor'
  | 'accentColor'
  | 'backgroundColor'
  | 'sidebarBgColor'
  | 'destructiveColor'
  | 'fontFamily'
  | 'borderRadius'
  | 'buttonStyle'
  | 'darkModeDefault'
>

export interface ThemePreset {
  /** URL-safe id, also used as the <option value>. */
  id: string
  /** Human-facing label in the picker. */
  label: string
  /** One-line description under the picker. */
  description: string
  /** The values to apply when this preset is chosen. */
  theme: ThemeShape
}

// ────────────────────────────────────────────
// The preset library. Kondense first (default), then variety.
// ────────────────────────────────────────────

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'kondense',
    label: 'Kondense',
    description: 'Red / orange, dark shell, comfortable radius. The platform default.',
    theme: {
      primaryColor: '#d11a1a',
      accentColor: '#f97316',
      backgroundColor: '#0a0a0b',
      sidebarBgColor: '#0a0a0a',
      destructiveColor: '#ef4444',
      fontFamily: 'inter',
      borderRadius: 'default',
      buttonStyle: 'default',
      darkModeDefault: true,
    },
  },
  {
    id: 'minimal-light',
    label: 'Minimal light',
    description: 'Neutral black-on-white with a blue accent. Comfortable radius.',
    theme: {
      primaryColor: '#171717',
      accentColor: '#3b82f6',
      backgroundColor: '#ffffff',
      sidebarBgColor: '#fafafa',
      destructiveColor: '#dc2626',
      fontFamily: 'inter',
      borderRadius: 'default',
      buttonStyle: 'default',
      darkModeDefault: false,
    },
  },
  {
    id: 'minimal-dark',
    label: 'Minimal dark',
    description: 'Neutral white-on-black with a soft blue accent. Sharp corners.',
    theme: {
      primaryColor: '#fafafa',
      accentColor: '#60a5fa',
      backgroundColor: '#000000',
      sidebarBgColor: '#0a0a0a',
      destructiveColor: '#ef4444',
      fontFamily: 'inter',
      borderRadius: 'sharp',
      buttonStyle: 'sharp',
      darkModeDefault: true,
    },
  },
  {
    id: 'high-contrast',
    label: 'High contrast',
    description: 'Maximum-contrast palette for accessibility. System font, sharp corners.',
    theme: {
      primaryColor: '#000000',
      accentColor: '#0000ff',
      backgroundColor: '#ffffff',
      sidebarBgColor: '#000000',
      destructiveColor: '#cc0000',
      fontFamily: 'system',
      borderRadius: 'sharp',
      buttonStyle: 'sharp',
      darkModeDefault: false,
    },
  },
  {
    id: 'serif-editorial',
    label: 'Serif editorial',
    description: 'Editorial serif look — deep navy on cream, pill-shaped buttons.',
    theme: {
      primaryColor: '#1e3a8a',
      accentColor: '#dc2626',
      backgroundColor: '#fef3c7',
      sidebarBgColor: '#1e3a8a',
      destructiveColor: '#991b1b',
      fontFamily: 'serif',
      borderRadius: 'rounded',
      buttonStyle: 'pill',
      darkModeDefault: false,
    },
  },
]

/** Look up a preset by id. */
export function findPreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id)
}

/** The default / platform preset. */
export function defaultPreset(): ThemePreset {
  return THEME_PRESETS[0]
}

/**
 * Given a current theme, guess which preset produced it (or none
 * when it doesn't match any). Compares only visual fields.
 */
export function matchingPresetId(theme: Partial<ThemeShape>): string | null {
  for (const preset of THEME_PRESETS) {
    let match = true
    for (const key of Object.keys(preset.theme) as (keyof ThemeShape)[]) {
      if (preset.theme[key] !== theme[key]) {
        match = false
        break
      }
    }
    if (match) return preset.id
  }
  return null
}
