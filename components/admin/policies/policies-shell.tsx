'use client'

// Root client shell for /admin/policies. Owns the visible view
// state (filters, selected policy) and defers all data mutations
// through server actions + router.refresh.
//
// Table-only for Phase 2; a future phase can add a card / gallery
// view. Detail page is /admin/policies/[id] (Phase 3), so this
// shell just wires row-click to router.push.

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Plus, Settings } from 'lucide-react'
import Link from 'next/link'

import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'

import type { PolicyWorkspacePayload } from '@/app/(admin)/admin/policies/actions'

import { CreatePolicyDialog } from './create-policy-dialog'
import { PoliciesFilterBar } from './policies-filter-bar'
import { PoliciesTable } from './policies-table'

type SortField = 'title' | 'createdAt' | 'updatedAt' | 'publishedAt'
type SortDir = 'asc' | 'desc'

interface PoliciesShellProps {
  initialData: PolicyWorkspacePayload
}

export function PoliciesShell({ initialData }: PoliciesShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isNavigating, startNavigation] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)

  const { policies, categories } = initialData

  function refreshWorkspace() {
    startNavigation(() => {
      router.refresh()
    })
  }

  // Sort state comes from the URL — the page re-fetches with the
  // new params on router.push. Defaults mirror policyFilterSchema.
  const sortBy = (searchParams.get('sort') as SortField) ?? 'title'
  const sortOrder = (searchParams.get('dir') as SortDir) ?? 'asc'

  const paramsCopy = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  )

  function handleSortChange(field: SortField) {
    const next = new URLSearchParams(paramsCopy)
    if (next.get('sort') === field) {
      next.set('dir', sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      next.set('sort', field)
      // Title defaults to A→Z; timestamps default to newest first.
      next.set('dir', field === 'title' ? 'asc' : 'desc')
    }
    startNavigation(() => {
      router.push(`/admin/policies?${next.toString()}`)
    })
  }

  function openPolicy(id: string) {
    // Detail page lands in Phase 3 — until then, the row click is a
    // no-op so operators don't hit a 404. Wired now so the table
    // component doesn't need a rewire when the page arrives.
    startNavigation(() => {
      router.push(`/admin/policies/${id}`)
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Policies"
        description="Internal ops documentation — role hats, processes, systems, onboarding."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              render={
                <Link
                  href="/admin/policies/settings"
                  aria-label="Category settings"
                />
              }
            >
              <Settings className="size-4" />
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New policy
            </Button>
          </div>
        }
      />

      <PoliciesFilterBar categories={categories} />

      <div
        aria-busy={isNavigating}
        className={isNavigating ? 'opacity-70 transition-opacity' : ''}
      >
        <PoliciesTable
          items={policies.items}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          onCreate={() => setCreateOpen(true)}
          onOpenPolicy={openPolicy}
          onRowChanged={refreshWorkspace}
        />
      </div>

      <CreatePolicyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async () => {
          setCreateOpen(false)
          refreshWorkspace()
        }}
        categories={categories}
      />
    </div>
  )
}
