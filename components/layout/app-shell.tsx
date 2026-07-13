'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { adminNav, memberNav, superNav } from '@/lib/config/navigation'
import { BrandMark } from './brand-mark'
import { CompanySwitcher } from './company-switcher'
import { PageTransition } from './page-transition'
import { SidebarNav } from './sidebar-nav'
import { SidebarProvider, useSidebar } from './sidebar-context'
import { TopBar } from './top-bar'
import { UserMenu, type ShellUser } from './user-menu'

interface AppShellCompanyOption {
  id: string
  name: string
  isAgency: boolean
}

/** The subset of resolved branding the shell needs on the client.
 *  Matches `ClientBranding` from `lib/branding/get-branding.ts`; kept
 *  as an inline shape so the shell file has no server-only imports. */
interface AppShellBranding {
  productName: string
  logoUrl: string
}

interface AppShellProps {
  role: 'admin' | 'member' | 'super'
  user: ShellUser
  /** Server-rendered initial collapsed state from cookie. */
  defaultCollapsed?: boolean
  /** Count of published announcements the current user hasn't
   *  opened — surfaces as a numeric pill on the Bell. */
  unreadAnnouncements?: number
  /** Server-resolved super-admin flag. Powers the "Super Admin"
   *  shortcut in the admin top bar so a super-admin never has to
   *  hunt for the /super entry point. */
  isSuperAdmin?: boolean
  /** Optional multi-tenancy context. When present, the sidebar
   *  renders a company switcher above the nav. Undefined means the
   *  tenancy feature flag is off — the sidebar looks exactly as it
   *  did pre-refactor. */
  tenancy?: {
    activeCompanyId: string | null
    companies: AppShellCompanyOption[]
    currentUserIsSuperAdmin: boolean
  }
  /** Optional resolved branding for the sidebar wordmark + logo.
   *  Undefined means "use platform defaults" (Kondense). Server
   *  layouts pass this via `getBranding()` when tenancy is on. */
  branding?: AppShellBranding
  children: React.ReactNode
}

export function AppShell({
  role,
  user,
  defaultCollapsed = false,
  unreadAnnouncements = 0,
  tenancy,
  isSuperAdmin = false,
  branding,
  children,
}: AppShellProps) {
  return (
    <SidebarProvider defaultCollapsed={defaultCollapsed}>
      <AppShellInner
        role={role}
        user={user}
        unreadAnnouncements={unreadAnnouncements}
        tenancy={tenancy}
        isSuperAdmin={isSuperAdmin}
        branding={branding}
      >
        {children}
      </AppShellInner>
    </SidebarProvider>
  )
}

function AppShellInner({
  role,
  user,
  unreadAnnouncements = 0,
  tenancy,
  isSuperAdmin = false,
  branding,
  children,
}: Omit<AppShellProps, 'defaultCollapsed'>) {
  const { collapsed } = useSidebar()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const sections =
    role === 'super' ? superNav : role === 'admin' ? adminNav : memberNav
  const context =
    role === 'super'
      ? 'Super Admin'
      : role === 'admin'
        ? 'Admin Console'
        : 'Member'
  const homeHref =
    role === 'super'
      ? '/super'
      : role === 'admin'
        ? '/admin/dashboard'
        : '/dashboard'
  const profileHref = role === 'member' ? '/profile' : '/admin/profile'

  return (
    <div
      className="min-h-screen bg-background"
      data-state={collapsed ? 'collapsed' : 'expanded'}
    >
      {/* Desktop sidebar — colour comes from the tenant's brand
       *   (--brand-sidebar), with the Kondense-default black as
       *   a fallback so the shell never renders unpainted. */}
      <aside
        data-sidebar="dark"
        style={{ background: 'var(--brand-sidebar, #0a0a0a)' }}
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col text-neutral-300 transition-[width] duration-200 ease-in-out lg:flex',
          collapsed ? 'w-14' : 'w-64',
        )}
      >
        <div
          className={cn(
            'flex h-14 items-center',
            collapsed ? 'justify-center px-2' : 'px-4',
          )}
        >
          <Link
            href={homeHref}
            className="flex items-center text-white"
            aria-label={context}
          >
            <BrandMark
              context={context}
              compact={collapsed}
              productName={branding?.productName}
              logoUrl={branding?.logoUrl}
            />
          </Link>
        </div>
        {tenancy ? (
          <div
            className={cn(
              'dark:border-t dark:border-[#ffffff0f]',
              collapsed ? 'flex justify-center p-2' : 'px-3 py-2',
            )}
          >
            <CompanySwitcher
              activeCompanyId={tenancy.activeCompanyId}
              companies={tenancy.companies}
              currentUserIsSuperAdmin={tenancy.currentUserIsSuperAdmin}
              collapsed={collapsed}
            />
          </div>
        ) : null}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3">
          <SidebarNav sections={sections} collapsed={collapsed} />
        </div>
        {/* Sidebar user mini-card — collapses to avatar-only when the
            sidebar is collapsed. Sits flush at the bottom for the
            classic Notion / Linear / Vercel pattern. */}
        <div
          className={cn(
            collapsed ? 'flex justify-center p-2' : 'p-2',
          )}
        >
          <UserMenu
            user={user}
            profileHref={profileHref}
            variant={collapsed ? 'topbar' : 'sidebar'}
          />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            data-sidebar="dark"
            style={{ background: 'var(--brand-sidebar, #0a0a0a)' }}
            className="absolute inset-y-0 left-0 flex w-72 flex-col text-neutral-300 animate-in slide-in-from-left"
          >
            <div className="flex h-14 items-center justify-between px-4">
              <span className="text-white">
                <BrandMark
                  context={context}
                  productName={branding?.productName}
                  logoUrl={branding?.logoUrl}
                />
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="text-neutral-300 hover:bg-white/10 hover:text-white"
              >
                <X />
              </Button>
            </div>
            {tenancy ? (
              <div className="px-3 py-2 dark:border-t dark:border-[#ffffff0f]">
                <CompanySwitcher
                  activeCompanyId={tenancy.activeCompanyId}
                  companies={tenancy.companies}
                  currentUserIsSuperAdmin={tenancy.currentUserIsSuperAdmin}
                />
              </div>
            ) : null}
            <div className="flex-1 overflow-y-auto py-3">
              <SidebarNav
                sections={sections}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
            <div className="p-2">
              <UserMenu
                user={user}
                profileHref={profileHref}
                variant="sidebar"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main column */}
      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200 ease-in-out',
          collapsed ? 'lg:pl-14' : 'lg:pl-64',
        )}
      >
        <TopBar
          onMenuClick={() => setDrawerOpen(true)}
          user={user}
          profileHref={profileHref}
          role={role}
          unreadAnnouncements={unreadAnnouncements}
          isSuperAdmin={isSuperAdmin}
        />
        <main className="flex-1">
          <div className="p-4 sm:p-6 lg:p-8">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>
    </div>
  )
}
