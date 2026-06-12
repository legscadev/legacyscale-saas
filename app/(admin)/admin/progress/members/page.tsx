import Link from 'next/link'
import { ChevronRight, Users } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { EmptyState, SectionCard, StatusBadge } from '@/components/shared'
import { getInitials, relativeTime } from '@/lib/format'
import { adminProgressService } from '@/lib/services/admin-progress-service'
import { MembersListFilters } from '@/components/admin/progress/members-list-filters'

interface PageProps {
  searchParams: Promise<{ search?: string; role?: string }>
}

export default async function AdminProgressMembersPage({
  searchParams,
}: PageProps) {
  const params = await searchParams
  const search = params.search ?? ''
  const roleParam = params.role
  const role: 'ALL' | 'MEMBER' | 'TEAM' =
    roleParam === 'MEMBER' || roleParam === 'TEAM' ? roleParam : 'ALL'

  const members = await adminProgressService.listMembersWithProgress({
    search,
    role,
  })

  return (
    <div className="space-y-4">
      <MembersListFilters initialSearch={search} initialRole={role} />

      <SectionCard
        title={`${members.length} ${
          members.length === 1 ? 'member' : 'members'
        }`}
        description={
          search
            ? `Matching "${search}"`
            : 'Members with at least one enrollment, sorted by most recent activity.'
        }
        flush
      >
        {members.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="No members yet"
              description={
                search
                  ? 'Try adjusting your search or role filter.'
                  : 'Once users enroll in a course, they will appear here.'
              }
            />
          </div>
        ) : (
          <ul className="divide-y">
            {members.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/admin/progress/members/${m.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40"
                >
                  <Avatar>
                    {m.avatarUrl ? <AvatarImage src={m.avatarUrl} /> : null}
                    <AvatarFallback>
                      {getInitials(m.name, m.email)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {m.name ?? m.email.split('@')[0]}
                      </p>
                      <StatusBadge status={m.role} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.email}
                    </p>
                  </div>

                  <div className="hidden w-32 shrink-0 md:block">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={m.avgProgressPercent}
                        className="h-1.5 flex-1"
                      />
                      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                        {m.avgProgressPercent}%
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      avg across {m.totalEnrollments}{' '}
                      {m.totalEnrollments === 1 ? 'course' : 'courses'}
                    </p>
                  </div>

                  <div className="hidden w-24 shrink-0 text-right md:block">
                    <p className="text-sm font-semibold tabular-nums">
                      {m.completedCourses}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      completed
                    </p>
                  </div>

                  <div className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground sm:block">
                    {relativeTime(m.lastActivity)}
                  </div>

                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
