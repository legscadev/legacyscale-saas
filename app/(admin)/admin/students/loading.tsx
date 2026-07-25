import { TableSkeleton } from '@/components/shared'

export default function AdminMembersLoading() {
  return <TableSkeleton columns={6} rows={10} />
}
