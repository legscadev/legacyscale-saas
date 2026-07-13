// Per-tenant web app manifest.
//
// Renders as `/manifest.webmanifest` and is referenced from the root
// layout's metadata. Values come from `getBranding()` so a tenant's
// installed PWA shows their productName, primaryColor, favicon.
//
// Route handler (not the static `app/manifest.ts` convention) so we
// can read request-scoped tenant state and skip Next's build-time
// caching for the manifest itself. Response is short — 200-400 bytes —
// so the extra hop is trivial.

import { NextResponse } from 'next/server'

import { getBranding } from '@/lib/branding/get-branding'

export async function GET() {
  const b = await getBranding()
  const description = b.tagline ?? b.productName
  return NextResponse.json(
    {
      name: b.productName,
      short_name: b.productName,
      description,
      start_url: '/',
      display: 'standalone',
      // Dark app shell matches the app's default theme; the tenant's
      // primary color is applied to the browser theme bar instead.
      background_color: '#0a0a0a',
      theme_color: b.primaryColor,
      icons: b.faviconUrl
        ? [
            {
              src: b.faviconUrl,
              sizes: 'any',
              type: b.faviconUrl.endsWith('.svg')
                ? 'image/svg+xml'
                : b.faviconUrl.endsWith('.png')
                  ? 'image/png'
                  : 'image/x-icon',
            },
          ]
        : [],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        // Cache lightly at the CDN — tenants may change branding at
        // any time and we want the change to land quickly.
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    },
  )
}
