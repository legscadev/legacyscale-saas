// Convert a #rrggbb hex string into the space-separated HSL triple
// ShadCN's CSS variables expect: "H S% L%" (no `hsl()`, no commas).
//
// Used by the root layout when injecting per-tenant color overrides
// so `bg-primary`, `text-destructive`, etc. resolve to the tenant's
// brand instead of Kondense's defaults.

export function hexToHslTriple(hex: string): string {
  const clean = hex.replace('#', '').toLowerCase()
  if (!/^[0-9a-f]{6}$/.test(clean)) return '0 0% 50%'
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

/** Read the lightness (%) out of a "H S% L%" triple. */
function lightnessOf(triple: string): number {
  const parts = triple.split(' ')
  const raw = parts[2]?.replace('%', '') ?? '50'
  return parseInt(raw, 10)
}

/** True when the given hex is closer to white than to black. Uses
 *  lightness > 55% as the pivot — reads well in practice for both
 *  saturated primaries and neutral greys. */
export function isLight(hex: string): boolean {
  return lightnessOf(hexToHslTriple(hex)) > 55
}

/**
 * Return the HSL triple for a foreground colour that contrasts
 * cleanly against `hex`. Near-black for light backgrounds; near-
 * white for dark backgrounds. Matches the values ShadCN uses in
 * :root and .dark so components already tuned for those tones
 * (borders, muted text, focus rings) still look right.
 */
export function contrastForegroundHslTriple(hex: string): string {
  return isLight(hex) ? '222 47% 11%' : '0 0% 98%'
}

/**
 * Shift the lightness of an HSL triple by `deltaPercent`, clamped
 * to [0, 100]. Positive nudges it lighter; negative, darker.
 */
export function nudgeLightness(triple: string, deltaPercent: number): string {
  const parts = triple.split(' ')
  const l = lightnessOf(triple)
  const newL = Math.max(0, Math.min(100, l + deltaPercent))
  return `${parts[0]} ${parts[1]} ${newL}%`
}
