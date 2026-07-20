import { TableSkeleton } from '@/components/shared'

// 7 cols mirrors the policies table (title / category / status /
// revision / updated / meta / actions) so there's no layout jump
// when the real data renders.
export default function AdminPoliciesLoading() {
  return <TableSkeleton columns={7} rows={8} />
}
