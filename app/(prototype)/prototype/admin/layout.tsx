import { cookies } from "next/headers"

import { AppShell } from "@/components/prototype/shell/app-shell"
import { SIDEBAR_COOKIE } from "@/components/layout/sidebar-cookie"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const defaultCollapsed =
    cookieStore.get(SIDEBAR_COOKIE)?.value === "1"

  return (
    <AppShell role="admin" defaultCollapsed={defaultCollapsed}>
      {children}
    </AppShell>
  )
}
