import { TableSkeleton } from '@/components/shared'

// 7 cols mirrors the tracker's row shape (title / status / priority /
// assignees / due / labels / meta) so there's no layout jump when
// the real data renders.
export default function AdminTasksLoading() {
  return <TableSkeleton columns={7} rows={8} />
}
