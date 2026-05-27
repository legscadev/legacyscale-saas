import { AppShell } from "@/components/prototype/shell/app-shell"

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell role="member">{children}</AppShell>
}
