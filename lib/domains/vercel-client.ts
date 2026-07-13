// Thin wrapper around Vercel's Projects Domains API.
//
// https://vercel.com/docs/rest-api/reference/endpoints/projects/add-a-domain-to-a-project
//
// The three functions the app cares about are add, status, and
// remove. Each returns a discriminated `ok` result so callers can
// pattern-match on outcomes without try/catch.
//
// When `VERCEL_API_TOKEN` or `VERCEL_PROJECT_ID` isn't set (local
// dev, or a self-hosted deploy), every function short-circuits with
// `{ ok: false, error: 'vercel-not-configured' }`. Callers use this
// to skip the Vercel step and fall back to verification-only.

const VERCEL_API = 'https://api.vercel.com'

interface Config {
  token?: string
  projectId?: string
  teamId?: string
}

function config(): Config {
  return {
    token: process.env.VERCEL_API_TOKEN,
    projectId: process.env.VERCEL_PROJECT_ID,
    teamId: process.env.VERCEL_TEAM_ID,
  }
}

/** True when both an API token and a project id are set. */
export function isVercelConfigured(): boolean {
  const c = config()
  return Boolean(c.token && c.projectId)
}

type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: string }
type SimpleResult = { ok: true } | { ok: false; error: string }

async function vercelFetch(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const c = config()
  const teamQuery = c.teamId ? `${path.includes('?') ? '&' : '?'}teamId=${c.teamId}` : ''
  const res = await fetch(`${VERCEL_API}${path}${teamQuery}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${c.token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // Empty body on 204s etc. — leave as null.
  }
  return { status: res.status, body }
}

function extractError(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const e = (body as { error: unknown }).error
    if (typeof e === 'object' && e !== null && 'message' in e) {
      return String((e as { message: unknown }).message ?? fallback)
    }
  }
  return fallback
}

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

interface AddDomainSuccess {
  verified: boolean
  vercelDomainId?: string
}

/**
 * Add a domain to the Vercel project. Returns `verified: true` when
 * the domain is already covered by a wildcard cert (e.g. a managed
 * subdomain); `false` when Vercel still needs SSL issuance / TXT
 * verification.
 */
export async function addDomainToProject(
  hostname: string,
): Promise<ApiResult<AddDomainSuccess>> {
  if (!isVercelConfigured()) return { ok: false, error: 'vercel-not-configured' }
  const c = config()
  const { status, body } = await vercelFetch(
    `/v10/projects/${c.projectId}/domains`,
    {
      method: 'POST',
      body: JSON.stringify({ name: hostname }),
    },
  )
  if (status < 200 || status >= 300) {
    return { ok: false, error: extractError(body, `add failed (${status})`) }
  }
  const b = body as { verified?: boolean; uid?: string }
  return { ok: true, verified: Boolean(b.verified), vercelDomainId: b.uid }
}

interface DomainStatus {
  verified: boolean
  sslIssued: boolean
}

/**
 * Fetch the current verification + SSL state for a hostname on the
 * Vercel project.
 */
export async function getDomainStatus(
  hostname: string,
): Promise<ApiResult<DomainStatus>> {
  if (!isVercelConfigured()) return { ok: false, error: 'vercel-not-configured' }
  const c = config()
  const { status, body } = await vercelFetch(
    `/v9/projects/${c.projectId}/domains/${encodeURIComponent(hostname)}`,
  )
  if (status < 200 || status >= 300) {
    return { ok: false, error: extractError(body, `status failed (${status})`) }
  }
  const b = body as { verified?: boolean; sslIssuanceInProgress?: boolean }
  return {
    ok: true,
    verified: Boolean(b.verified),
    sslIssued: Boolean(b.verified) && !b.sslIssuanceInProgress,
  }
}

/**
 * Remove a hostname from the Vercel project. Also drops its SSL
 * cert. Safe to call on a hostname that isn't attached — Vercel
 * returns 404 which we surface as ok:false.
 */
export async function removeDomainFromProject(
  hostname: string,
): Promise<SimpleResult> {
  if (!isVercelConfigured()) return { ok: false, error: 'vercel-not-configured' }
  const c = config()
  const { status, body } = await vercelFetch(
    `/v9/projects/${c.projectId}/domains/${encodeURIComponent(hostname)}`,
    { method: 'DELETE' },
  )
  if (status < 200 || status >= 300) {
    return { ok: false, error: extractError(body, `remove failed (${status})`) }
  }
  return { ok: true }
}
