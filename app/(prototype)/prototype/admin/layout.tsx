import { AppShell } from "@/components/prototype/shell/app-shell"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell role="admin">{children}</AppShell>
}
