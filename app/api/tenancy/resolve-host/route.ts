import { type NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

// Internal lookup used by proxy.ts (Edge) to resolve a verified
// custom-domain hostname to a tenant slug. Managed subdomains and
// platform host are resolved in-proxy without a DB call — this
// endpoint only exists for the CUSTOM branch.
//
// Response shape stays small (public JSON, no secrets):
//   { slug: string | null }
//
// Not rate-limited or auth-gated: hostnames aren't sensitive and
// unverified rows aren't matched. The proxy caches results in
// memory with a short TTL so this route sees at most a few hits
// per hostname per region.

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const host = request.nextUrl.searchParams.get('host')?.toLowerCase().trim()
  if (!host) return NextResponse.json({ slug: null })

  const domain = await prisma.domain.findFirst({
    where: { hostname: host, verifiedAt: { not: null } },
    select: {
      company: {
        select: { slug: true, deletedAt: true },
      },
    },
  })
  if (!domain?.company || domain.company.deletedAt !== null) {
    return NextResponse.json({ slug: null })
  }
  return NextResponse.json(
    { slug: domain.company.slug },
    {
      // Cache 60s at edge/CDN so serial requests share the lookup.
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
    },
  )
}
