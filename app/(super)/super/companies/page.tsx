import { formatDistanceToNow } from 'date-fns'
import { ArrowRight, Building2, Globe2 } from 'lucide-react'

import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { prisma } from '@/lib/prisma'
import { runAsSuperAdmin } from '@/lib/tenancy/request-company'

import { enterCompanyAction } from './actions'

export const dynamic = 'force-dynamic'

interface CompanyRow {
  id: string
  name: string
  slug: string
  customDomain: string | null
  isAgency: boolean
  createdAt: Date
  memberCount: number
  ownerName: string | null
}

async function listCompanies(): Promise<CompanyRow[]> {
  // runAsSuperAdmin is a no-op for `company` (not in the scoped
  // model list) but future-proofs against the extension gaining
  // Company scoping when we add nested sub-accounts.
  return runAsSuperAdmin(async () => {
    const companies = await prisma.company.findMany({
      where: { deletedAt: null },
      orderBy: [{ isAgency: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        customDomain: true,
        isAgency: true,
        createdAt: true,
        _count: { select: { memberships: true } },
        memberships: {
          where: { role: 'OWNER' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { user: { select: { name: true, email: true } } },
        },
      },
    })
    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      customDomain: c.customDomain,
      isAgency: c.isAgency,
      createdAt: c.createdAt,
      memberCount: c._count.memberships,
      ownerName:
        c.memberships[0]?.user.name ??
        c.memberships[0]?.user.email.split('@')[0] ??
        null,
    }))
  })
}

export default async function SuperCompaniesPage() {
  const companies = await listCompanies()

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Companies"
        description="Every tenant on the platform. Enter one to work inside its admin console as a super-admin."
      />

      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Once sub-accounts are being created (Phase 4), they'll show up here."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Owner</th>
                <th className="px-4 py-2.5 text-right">Members</th>
                <th className="px-4 py-2.5">Custom domain</th>
                <th className="px-4 py-2.5">Created</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded bg-brand-500/10 text-brand-600">
                        <Building2 className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium">
                            {c.name}
                          </span>
                          {c.isAgency ? (
                            <span className="rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                              Agency
                            </span>
                          ) : null}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {c.slug}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.ownerName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.memberCount}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.customDomain ? (
                      <span className="inline-flex items-center gap-1">
                        <Globe2 className="size-3.5" />
                        {c.customDomain}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDistanceToNow(c.createdAt, { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={enterCompanyAction}>
                      <input type="hidden" name="companyId" value={c.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                      >
                        Enter
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
