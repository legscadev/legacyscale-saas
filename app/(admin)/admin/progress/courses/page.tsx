import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, GraduationCap } from 'lucide-react'

import { Progress } from '@/components/ui/progress'
import { EmptyState, SectionCard, StatusBadge } from '@/components/shared'
import { cn } from '@/lib/utils'
import { adminProgressService } from '@/lib/services/admin-progress-service'

export default async function AdminProgressCoursesPage() {
  const courses = await adminProgressService.listCoursesWithProgress()

  return (
    <SectionCard
      title={`${courses.length} ${
        courses.length === 1 ? 'course' : 'courses'
      }`}
      description="Click a course to see its full cohort with progress, filters, and CSV export."
      flush
    >
      {courses.length === 0 ? (
        <div className="p-6">
          <EmptyState
            icon={GraduationCap}
            title="No courses yet"
            description="Create a course on the Courses page to start tracking cohort progress."
          />
        </div>
      ) : (
        <ul className="divide-y">
          {courses.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/progress/courses/${c.id}`}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/40"
              >
                <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-brand-500 to-brand-700 ring-1 ring-foreground/5">
                  {c.thumbnailUrl ? (
                    <Image
                      src={c.thumbnailUrl}
                      alt={c.title}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-sm font-bold text-white/85">
                      {c.title.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">
                      {c.title}
                    </p>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.enrolledCount} enrolled · {c.activeCount} active ·{' '}
                    {c.completedCount} completed
                  </p>
                </div>

                <div className="hidden w-40 shrink-0 md:block">
                  <div className="flex items-center gap-2">
                    <Progress
                      value={c.avgProgressPercent}
                      className="h-1.5 flex-1"
                    />
                    <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                      {c.avgProgressPercent}%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    avg progress
                  </p>
                </div>

                <div className="hidden w-24 shrink-0 text-right md:block">
                  <p
                    className={cn(
                      'text-sm font-semibold tabular-nums',
                      c.completionRate >= 50
                        ? 'text-success'
                        : 'text-foreground',
                    )}
                  >
                    {c.completionRate}%
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    completion
                  </p>
                </div>

                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
