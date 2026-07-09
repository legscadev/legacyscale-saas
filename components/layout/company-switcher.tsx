'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Check, ChevronDown, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import Link from 'next/link'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface CompanyOption {
  id: string
  name: string
  isAgency: boolean
}

interface CompanySwitcherProps {
  activeCompanyId: string | null
  companies: CompanyOption[]
  currentUserIsSuperAdmin: boolean
  /** True when the sidebar is collapsed to icons only — the
   *  switcher renders as a compact icon in that mode. */
  collapsed?: boolean
}

/**
 * Sidebar-top dropdown that lists every company the current user
 * can enter. Behind the tenancy flag — only rendered when the
 * server passes companies down, which itself only happens when
 * TENANCY_ENABLED is truthy.
 */
export function CompanySwitcher({
  activeCompanyId,
  companies,
  currentUserIsSuperAdmin,
  collapsed = false,
}: CompanySwitcherProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const active = companies.find((c) => c.id === activeCompanyId) ?? companies[0]
  if (!active) return null

  function selectCompany(companyId: string) {
    if (companyId === active?.id) {
      setOpen(false)
      return
    }
    startTransition(async () => {
      const response = await fetch('/api/tenancy/switch-company', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        toast.error(body?.error ?? 'Could not switch company')
        return
      }
      setOpen(false)
      // Router refresh re-runs the layout so every server component
      // picks up the new active-company cookie without a full reload.
      router.refresh()
    })
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label="Switch company"
        disabled={pending}
        render={
          <button
            type="button"
            className={cn(
              'group/company flex w-full items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.03] text-left transition-colors hover:bg-white/[0.06]',
              collapsed ? 'size-9 justify-center' : 'px-2 py-1.5',
            )}
          />
        }
      >
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded bg-brand-500/15 text-brand-300',
            collapsed && 'size-5',
          )}
        >
          <Building2 className="size-3.5" />
        </span>
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-100">
              {active.name}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-neutral-500 transition-transform group-data-[state=open]/company:rotate-180" />
          </>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {currentUserIsSuperAdmin ? 'All companies' : 'Your companies'}
        </div>
        {companies.map((company) => {
          const isActive = company.id === active.id
          return (
            <DropdownMenuItem
              key={company.id}
              onClick={() => selectCompany(company.id)}
              disabled={pending}
              className="gap-2"
            >
              <Building2 className="size-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                {company.name}
                {company.isAgency ? (
                  <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-brand-500">
                    · Agency
                  </span>
                ) : null}
              </span>
              {isActive ? (
                <Check className="size-3.5 text-brand-400" />
              ) : null}
            </DropdownMenuItem>
          )
        })}
        {currentUserIsSuperAdmin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2"
              render={<Link href="/super/companies" />}
            >
              <ShieldCheck className="size-4 text-brand-500" />
              <span className="flex-1">Manage all companies</span>
            </DropdownMenuItem>
            <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-brand-400" />
              Super-admin — you can enter any company
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
