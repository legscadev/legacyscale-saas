import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getBranding } from "@/lib/branding/get-branding"
import { hexToHslTriple } from "@/lib/branding/hex-to-hsl"
import type { Branding } from "@/lib/branding/schema"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

// Dynamic metadata so the browser tab title + favicon + Open Graph
// image + web-app manifest reflect the caller's active tenant. Falls
// back to the Kondense platform defaults when tenancy is off, when
// there's no signed-in caller, or when a tenant hasn't set its own
// brand. Cached per request through `getBranding()`.
export async function generateMetadata(): Promise<Metadata> {
  const b = await getBranding()
  const description = b.tagline ?? b.productName
  return {
    title: b.productName,
    description,
    icons: { icon: b.faviconUrl },
    manifest: '/manifest.webmanifest',
    openGraph: {
      siteName: b.productName,
      title: b.productName,
      description,
      images: b.ogImageUrl ? [{ url: b.ogImageUrl }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: b.productName,
      description,
      images: b.ogImageUrl ? [b.ogImageUrl] : undefined,
    },
  }
}

// Runs before React hydration. Reads the persisted theme and applies
// the `dark` class so the first paint matches the user's preference
// (no flash). When the user hasn't chosen a theme yet, uses the
// tenant's `darkModeDefault` (injected at render time).
function themeInitScript(darkModeDefault: boolean): string {
  return `
(function(){
  try {
    var t = localStorage.getItem('theme');
    if (t !== 'light' && t !== 'dark') t = ${darkModeDefault ? "'dark'" : "'light'"};
    document.documentElement.classList.toggle('dark', t === 'dark');
  } catch (e) {
    document.documentElement.classList.${darkModeDefault ? 'add' : 'remove'}('dark');
  }
})();
`
}

/** Build the inline CSS-variable overrides that make the tenant's
 *  brand actually drive ShadCN. All shipped as `H S% L%` triples so
 *  the `hsl(var(--…))` wrappers in globals.css resolve correctly.
 *  Font family is spread inline (not via [data-font] CSS) so it
 *  beats next/font's per-body class override on --font-sans. */
function themeStyle(b: Branding): React.CSSProperties {
  const radius =
    b.borderRadius === 'sharp'
      ? '0.125rem'
      : b.borderRadius === 'rounded'
        ? '1rem'
        : '0.5rem'
  const fontOverride =
    b.fontFamily === 'system'
      ? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
      : b.fontFamily === 'serif'
        ? 'Georgia, ui-serif, "Times New Roman", serif'
        : undefined // leave --font-sans alone for "inter" — Next's class wins
  return {
    // ShadCN core tokens (HSL)
    ['--primary' as string]: hexToHslTriple(b.primaryColor),
    ['--ring' as string]: hexToHslTriple(b.primaryColor),
    ['--background' as string]: hexToHslTriple(b.backgroundColor),
    ['--destructive' as string]: hexToHslTriple(b.destructiveColor),
    ['--radius' as string]: radius,
    // Raw-hex brand tokens for components that read them directly
    ['--brand-primary' as string]: b.primaryColor,
    ['--brand-accent' as string]: b.accentColor,
    ['--brand-bg' as string]: b.backgroundColor,
    ['--brand-sidebar' as string]: b.sidebarBgColor,
    ['--brand-destructive' as string]: b.destructiveColor,
    // Legacy alias kept in place (some older components read this).
    ['--brand-500' as string]: b.primaryColor,
    // Font family — only set when tenant picks something other than
    // Inter (Inter is loaded via next/font and already in --font-sans).
    ...(fontOverride ? { ['--font-sans' as string]: fontOverride } : {}),
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const b = await getBranding()
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-font={b.fontFamily}
      data-button-style={b.buttonStyle}
      data-radius={b.borderRadius}
      // Inter's next/font class lives on <html> (not <body>) so my
      // inline style on <html> can override --font-sans when the
      // tenant picks system / serif. Otherwise next/font's per-body
      // class would win by proximity.
      className={inter.variable}
      style={themeStyle(b)}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themeInitScript(b.darkModeDefault),
          }}
        />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
        )}
      >
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  )
}
