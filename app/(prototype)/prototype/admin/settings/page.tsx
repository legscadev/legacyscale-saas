import { Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageContainer } from "@/components/prototype/shared/page-container"
import { PageHeader } from "@/components/prototype/shared/page-header"
import { StatusBadge } from "@/components/prototype/shared/status-badge"
import { InviteMemberDialog } from "@/components/prototype/members/invite-member-dialog"
import { currentAdmin, initials, members } from "@/lib/prototype"

export default function AdminSettings() {
  const admins = members.filter((m) => m.role === "ADMIN")

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Manage your profile, platform, and integrations."
      />

      <Tabs defaultValue="profile" className="mt-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="platform">Platform</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="pt-4">
          <Card className="max-w-xl gap-4 p-5">
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarFallback>{initials(currentAdmin.name)}</AvatarFallback>
              </Avatar>
              <Button variant="outline" size="sm">
                Change photo
              </Button>
            </div>
            <Labeled label="Name">
              <Input defaultValue={currentAdmin.name} />
            </Labeled>
            <Labeled label="Email">
              <Input defaultValue={currentAdmin.email} type="email" />
            </Labeled>
            <Button className="w-fit">Save changes</Button>
          </Card>
        </TabsContent>

        <TabsContent value="platform" className="pt-4">
          <Card className="max-w-xl gap-4 p-5">
            <Labeled label="Platform name">
              <Input defaultValue="Legacy Scale" />
            </Labeled>
            <Labeled label="Support email">
              <Input defaultValue="support@legacyscale.co" type="email" />
            </Labeled>
            <Labeled label="Default course access">
              <Input defaultValue="Lifetime" />
            </Labeled>
            <Button className="w-fit">Save changes</Button>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4 pt-4">
          <Card className="gap-3 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">GoHighLevel</p>
                <p className="text-xs text-muted-foreground">
                  Members are enrolled automatically when they purchase.
                </p>
              </div>
              <StatusBadge status="ACTIVE" label="Connected" />
            </div>
            <Labeled label="Webhook URL">
              <div className="flex gap-2">
                <Input
                  readOnly
                  defaultValue="https://api.legacyscale.co/webhooks/ghl/9f3a…"
                />
                <Button variant="outline" size="icon" aria-label="Copy URL">
                  <Copy />
                </Button>
              </div>
            </Labeled>
          </Card>

          <Card className="gap-3 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Mux</p>
                <p className="text-xs text-muted-foreground">
                  Powers video hosting, encoding, and streaming.
                </p>
              </div>
              <StatusBadge status="ACTIVE" label="Connected" />
            </div>
            <Labeled label="API key">
              <Input readOnly defaultValue="mux_••••••••••••••••3f2c" />
            </Labeled>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="pt-4">
          <Card className="gap-0 p-0">
            <div className="flex items-center justify-between border-b p-4">
              <p className="text-sm font-semibold">Administrators</p>
              <InviteMemberDialog
                triggerLabel="Invite admin"
                defaultRole="ADMIN"
                triggerSize="sm"
              />
            </div>
            <ul className="divide-y">
              {admins.map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-4">
                  <Avatar size="sm">
                    <AvatarFallback>{initials(a.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.email}</p>
                  </div>
                  <StatusBadge status="ADMIN" />
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}

function Labeled({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
