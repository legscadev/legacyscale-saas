import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  GraduationCap,
  Plus,
  ShieldCheck,
  Ticket,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import {
  EmptyState,
  SectionCard,
  StatStrip,
  type StatStripCell,
} from '@/components/shared'
import { Button } from '@/components/ui/button'
import { relativeTime } from '@/lib/format'
import { prisma } from '@/lib/prisma'
import { runAsSuperAdmin } from '@/lib/tenancy/request-company'

export const dynamic = 'force-dynamic'

const NEWEST_LIMIT = 5
const ATTENTION_LIMIT = 5

/**
 * Cross-tenant snapshot. All counts run inside runAsSuperAdmin so
 * the Prisma tenancy extension steps out of the way — otherwise
 * these totals would silently narrow to whichever tenant the
 * super-admin's active_company_id cookie points at.
 */
async function loadOverview() {
  return runAsSuperAdmin(async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [
      companies,
      users,
      superAdmins,
      publishedCourses,
      totalCourses,
      activeEnrollments,
      newestCompanies,
      allCompaniesLite,
      courseCounts,
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
      // Newest tenants — top 5 by created_at. Owner column reads the
      // first OWNER membership on the row so the operator can see
      // who was assigned at creation time at a glance.
      prisma.company.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: NEWEST_LIMIT,
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          _count: { select: { memberships: true } },
          memberships: {
            where: { role: 'OWNER' },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { user: { select: { name: true, email: true } } },
          },
        },
      }),
      // For the "needs attention" panel — we want tenants with 0
      // members OR 0 courses. Course has no Prisma-side back-relation
      // to Company (tenancy is enforced by the runtime extension, not
      // a schema relation), so we can't `_count.courses` inline.
      // Instead pull every tenant with membership counts + a separate
      // groupBy for course counts, then merge + filter in JS. Cheap
      // on our current tenant-count scale; revisit when > 500 tenants.
      prisma.company.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { memberships: true } },
        },
      }),
      prisma.course.groupBy({
        by: ['companyId'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
    ])

    const courseCountByCompany = new Map<string, number>(
      courseCounts.map((row) => [row.companyId, row._count._all]),
    )
    const attentionCompanies = allCompaniesLite
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        memberCount: c._count.memberships,
        courseCount: courseCountByCompany.get(c.id) ?? 0,
      }))
      .filter((c) => c.memberCount === 0 || c.courseCount === 0)
      .slice(0, ATTENTION_LIMIT)

    return {
      companies,
      users,
      superAdmins,
      publishedCourses,
      totalCourses,
      activeEnrollments,
      newestCompanies,
      attentionCompanies,
    }
  })
}

function ownerLabel(
  memberships: Array<{ user: { name: string | null; email: string } }>,
): string {
  const first = memberships[0]
  if (!first) return '—'
  return first.user.name || first.user.email.split('@')[0]
}

type AttentionRow = Awaited<ReturnType<typeof loadOverview>>['attentionCompanies'][number]

function attentionReason(c: AttentionRow): string {
  const parts: string[] = []
  if (c.memberCount === 0) parts.push('no members')
  if (c.courseCount === 0) parts.push('no courses')
  return parts.join(' · ') || 'needs review'
}

interface QuickAction {
  label: string
  href: string
  icon: LucideIcon
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Create company', href: '/super/companies/new', icon: Plus },
  { label: 'Grant super-admin', href: '/super/super-admins', icon: ShieldCheck },
  { label: 'Manage all companies', href: '/super/companies', icon: Building2 },
]

export default async function SuperLandingPage() {
  const o = await loadOverview()

  const cells: StatStripCell[] = [
    {
      label: 'Companies',
      value: o.companies,
      icon: Building2,
      description: 'Active tenants',
    },
    {
      label: 'Users',
      value: o.users,
      icon: Users,
      description: 'Across every tenant',
    },
    {
      label: 'Courses',
      value: o.publishedCourses,
      icon: GraduationCap,
      description:
        o.totalCourses === o.publishedCourses
          ? 'All published'
          : `${o.totalCourses} total, published shown`,
    },
    {
      label: 'Active enrollments',
      value: o.activeEnrollments,
      icon: Ticket,
      description: 'Last 30 days',
    },
    {
      label: 'Super-admins',
      value: o.superAdmins,
      icon: ShieldCheck,
      description: 'Users with the master key',
    },
  ]

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Super Admin"
        description="A read of every tenant on the platform. Numbers are live — no cache."
      />

      <StatStrip cells={cells} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard
            title="Newest tenants"
            description={`The ${NEWEST_LIMIT} most recently provisioned companies.`}
            action={
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/super/companies" />}
              >
                All companies
              </Button>
            }
            flush
          >
            {o.newestCompanies.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No companies yet"
                description="Once you create a tenant, it'll show up here."
              />
            ) : (
              <ul className="divide-y">
                {o.newestCompanies.map((c) => (
                  <li key={c.id}>
                    <Link
                      href="/super/companies"
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {c.name}
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {c.slug}
                          </span>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          Owner {ownerLabel(c.memberships)} ·{' '}
                          {c._count.memberships}{' '}
                          {c._count.memberships === 1 ? 'member' : 'members'} ·{' '}
                          created {relativeTime(c.createdAt)}
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Needs attention"
            description="Tenants missing structural pieces — no members or no courses."
            flush
          >
            {o.attentionCompanies.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="Every tenant looks healthy"
                description="No companies with zero members or zero courses."
              />
            ) : (
              <ul className="divide-y">
                {o.attentionCompanies.map((c) => (
                  <li key={c.id}>
                    <Link
                      href="/super/companies"
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                        <AlertTriangle className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {c.name}
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {c.slug}
                          </span>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {attentionReason(c)}
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Quick actions">
            <div className="flex flex-col gap-2">
              {QUICK_ACTIONS.map((a) => (
                <Button
                  key={a.href}
                  variant="outline"
                  className="justify-start"
                  render={<Link href={a.href} />}
                >
                  <a.icon />
                  {a.label}
                </Button>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="At a glance"
            description="Ratios worth watching."
          >
            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Users per tenant</span>
                <span className="font-semibold tabular-nums">
                  {o.companies > 0
                    ? (o.users / o.companies).toFixed(1)
                    : '—'}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Courses per tenant
                </span>
                <span className="font-semibold tabular-nums">
                  {o.companies > 0
                    ? (o.totalCourses / o.companies).toFixed(1)
                    : '—'}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Draft-to-published
                </span>
                <span className="font-semibold tabular-nums">
                  {o.publishedCourses > 0
                    ? `${o.totalCourses - o.publishedCourses}:${o.publishedCourses}`
                    : `${o.totalCourses}:0`}
                </span>
              </li>
              <li className="flex items-center justify-between border-t pt-3">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <UsersRound className="size-3.5" />
                  Super-admin coverage
                </span>
                <span className="font-semibold tabular-nums">
                  {o.superAdmins}
                </span>
              </li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
