import { PageHeader } from '@/components/shared/page-header'

/**
 * Super-admin landing. 3.3 replaces this stub with the cross-tenant
 * KPI strip. Kept minimal here so the route group + auth gate can
 * land independently.
 */
export default function SuperLandingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Super Admin"
        description="Every tenant on the platform, one page above them all."
      />
      <div className="rounded-lg border border-dashed p-8 text-sm text-muted-foreground">
        Cross-tenant KPIs land in Phase 3.3. Use the Companies link in
        the sidebar to browse tenants.
      </div>
    </div>
  )
}
