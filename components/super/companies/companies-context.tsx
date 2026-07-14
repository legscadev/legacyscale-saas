'use client'

import { createContext, useContext } from 'react'

/**
 * Refetch handle exposed by CompaniesShell down to row-level actions
 * (delete, clone, future edits). Row actions call `refetch()` after a
 * successful mutation so the client-side state re-syncs — without it,
 * `router.refresh()` alone leaves the deleted row visible because the
 * shell holds its own client-state copy of the list. Null context is
 * a no-op fallback so the actions component stays usable outside the
 * shell (e.g. Storybook).
 */
export interface CompaniesContextValue {
  refetch: () => void
}

const CompaniesContext = createContext<CompaniesContextValue | null>(null)

export const CompaniesProvider = CompaniesContext.Provider

export function useCompaniesRefetch(): () => void {
  const ctx = useContext(CompaniesContext)
  return ctx?.refetch ?? (() => {})
}
