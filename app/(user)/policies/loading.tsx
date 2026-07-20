import { TableSkeleton } from '@/components/shared'

// 6 cols mirrors the TEAM read view of the policies table (title,
// category, status, revision, updated, meta) — one less than the
// admin surface since the actions column is hidden.
export default function MemberPoliciesLoading() {
  return <TableSkeleton columns={6} rows={8} />
}
