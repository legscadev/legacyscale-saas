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
