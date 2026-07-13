// Platform host constants.
//
// Two env vars control where the "main" app lives (super console,
// unbranded fallback) and where managed subdomains hang off of:
//
//   PLATFORM_HOST         — e.g. "app.kondense.ai". Requests to this
//                           host land on the platform surface, not a
//                           tenant.
//   PLATFORM_APEX_DOMAIN  — e.g. "kondense.ai". Managed subdomains
//                           get constructed as `<slug>.<apex>`.
//
// Both fall back to localhost values for dev without a DNS setup,
// so subdomain resolution still works via `<slug>.localhost:3000`
// in modern browsers (Chrome + Firefox both resolve *.localhost).

/** The hostname the platform's own admin surface lives at. */
export function getPlatformHost(): string {
  return process.env.PLATFORM_HOST ?? 'localhost:3000'
}

/** The apex domain managed subdomains hang off of. */
export function getPlatformApexDomain(): string {
  return process.env.PLATFORM_APEX_DOMAIN ?? 'localhost'
}

/** Construct a managed subdomain hostname for a given slug. */
export function managedSubdomainFor(slug: string): string {
  return `${slug}.${getPlatformApexDomain()}`
}

/** True when `host` is the platform's own admin surface. */
export function isPlatformHost(host: string): boolean {
  return host === getPlatformHost()
}
