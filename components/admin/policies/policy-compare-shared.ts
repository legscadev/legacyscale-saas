// Server-safe helpers for the policy compare view. Kept out of the
// 'use client' file so page.tsx server components can call
// buildSnapshot() without tripping the "can't call client function
// from server" runtime check.

import type {
  PolicyDetail,
  PolicyRevisionRow,
} from '@/lib/services/policy-service'

export const CURRENT_SENTINEL = 'current'

export interface SnapshotSlot {
  /** Human label for the picker + column header. */
  label: string
  /** Rev N label (or 'Draft' / 'Current') for the badge. */
  revision: number
  title: string
  body: string | null
  publishedAt: Date | null
  publishedByName: string | null
  /** Set for frozen-revision slots so we can offer Revert. */
  revisionId: string | null
}

/**
 * Turns a Policy + optional Revision into the flat SnapshotSlot the
 * compare view renders. Revision=null → maps to the current draft
 * on the Policy row.
 */
export function buildSnapshot({
  policy,
  revision,
}: {
  policy: PolicyDetail
  revision: (PolicyRevisionRow & { body: string | null }) | null
}): SnapshotSlot {
  if (revision === null) {
    return {
      label:
        policy.revision === 0
          ? 'Current draft'
          : `Current (Rev ${policy.revision})`,
      revision: policy.revision,
      title: policy.title,
      body: policy.body,
      publishedAt: policy.publishedAt,
      publishedByName:
        policy.updatedByUser?.name ??
        policy.updatedByUser?.email.split('@')[0] ??
        null,
      revisionId: null,
    }
  }
  return {
    label: `Rev ${revision.revision}`,
    revision: revision.revision,
    title: revision.title,
    body: revision.body,
    publishedAt: revision.publishedAt,
    publishedByName:
      revision.publishedBy?.name ??
      revision.publishedBy?.email.split('@')[0] ??
      null,
    revisionId: revision.id,
  }
}
