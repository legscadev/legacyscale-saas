import {
  Building2,
  GraduationCap,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { StatStrip, type StatStripCell } from '@/components/shared'
import { prisma } from '@/lib/prisma'
import { runAsSuperAdmin } from '@/lib/tenancy/request-company'

export const dynamic = 'force-dynamic'

/**
 * Cross-tenant snapshot. All counts run inside runAsSuperAdmin so
 * the Prisma tenancy extension steps out of the way — otherwise
 * these totals would silently narrow to whichever tenant the
 * super-admin's active_company_id cookie points at.
 */
async function loadKpis() {
  return runAsSuperAdmin(async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [
      companies,
      users,
      superAdmins,
      publishedCourses,
      totalCourses,
      activeEnrollments,
    ] = await Promise.all([
      prisma.company.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      prisma.user.count({ where: { deletedAt: null, isSuperAdmin: true } }),
      prisma.course.count({
        where: { deletedAt: null, status: 'PUBLISHED' },
      }),
      prisma.course.count({ where: { deletedAt: null } }),
      prisma.enrollment.count({
        where: {
          status: { not: 'REVOKED' },
          lastAccessedAt: { gte: thirtyDaysAgo },
        },
      }),
    ])

    return {
      companies,
      users,
      superAdmins,
      publishedCourses,
      totalCourses,
      activeEnrollments,
    }
  })
}

export default async function SuperLandingPage() {
  const kpis = await loadKpis()

  const cells: StatStripCell[] = [
    {
      label: 'Companies',
      value: kpis.companies,
      icon: Building2,
      description: 'Active tenants',
    },
    {
      label: 'Users',
      value: kpis.users,
      icon: Users,
      description: 'Across every tenant',
    },
    {
      label: 'Courses',
      value: kpis.publishedCourses,
      icon: GraduationCap,
      description: `${kpis.totalCourses} total, published shown`,
    },
    {
      label: 'Super-admins',
      value: kpis.superAdmins,
      icon: ShieldCheck,
      description: 'Users with the master key',
    },
  ]

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Super Admin"
        description="A read of every tenant on the platform. Numbers are live — no cache."
      />

      <StatStrip cells={cells} />

      <div className="rounded-lg border p-6 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShieldCheck className="size-4 text-brand-500" />
          <span>
            Active enrolments in the last 30 days:{' '}
            <span className="font-semibold text-foreground tabular-nums">
              {kpis.activeEnrollments}
            </span>
          </span>
        </div>
        <p className="mt-2 text-muted-foreground">
          Sub-account creation (Phase 4), white-label branding (Phase
          5), and custom-domain routing (Phase 6) will surface their
          own controls above this strip.
        </p>
      </div>
    </div>
  )
}
