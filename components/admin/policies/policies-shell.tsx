'use client'

// Placeholder shell for Phase 2.1 — Phase 2.3 fleshes out the
// filter bar, table, and URL-driven refetch. Rendering the raw
// payload here lets us verify the workspace fetcher + auth gate
// end-to-end before layering UI on top.

import type { PolicyWorkspacePayload } from '@/app/(admin)/admin/policies/actions'

interface PoliciesShellProps {
  initialData: PolicyWorkspacePayload
}

export function PoliciesShell({ initialData }: PoliciesShellProps) {
  const { policies, categories } = initialData

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Policies</h1>
        <p className="text-sm text-muted-foreground">
          Internal ops documentation — role hats, processes, systems,
          onboarding.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {policies.total} polic{policies.total === 1 ? 'y' : 'ies'} ·{' '}
          {categories.length} categor
          {categories.length === 1 ? 'y' : 'ies'}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Phase 2.3 will layer the filter bar + table here.
        </p>
      </section>
    </div>
  )
}
