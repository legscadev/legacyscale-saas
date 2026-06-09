import Link from "next/link"
import { LifeBuoy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageContainer } from "@/components/prototype/shared/page-container"
import { PageHeader } from "@/components/prototype/shared/page-header"
import { StatusBadge } from "@/components/prototype/shared/status-badge"
import {
  currentMember,
  enrollments,
  formatDate,
  initials,
} from "@/lib/prototype"

export default function MemberAccount() {
  const access = enrollments.filter((e) => e.user.id === currentMember.id)

  return (
    <PageContainer>
      <PageHeader title="Account" description="Manage your profile and access." />

      <Tabs defaultValue="profile" className="mt-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="pt-4">
          <Card className="max-w-xl gap-4 p-5">
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarFallback>{initials(currentMember.name)}</AvatarFallback>
              </Avatar>
              <Button variant="outline" size="sm">
                Change photo
              </Button>
            </div>
            <Field label="Name">
              <Input defaultValue={currentMember.name} />
            </Field>
            <Field label="Email">
              <Input defaultValue={currentMember.email} type="email" />
            </Field>
            <Button className="w-fit">Save changes</Button>
          </Card>
        </TabsContent>

        <TabsContent value="password" className="pt-4">
          <Card className="max-w-xl gap-4 p-5">
            <Field label="Current password">
              <Input type="password" defaultValue="" />
            </Field>
            <Field label="New password">
              <Input type="password" defaultValue="" />
            </Field>
            <Field label="Confirm new password">
              <Input type="password" defaultValue="" />
            </Field>
            <Button className="w-fit">Update password</Button>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-4 pt-4">
          {access.map((e) => (
            <Card key={e.id} className="gap-2 p-5">
              <div className="flex items-center justify-between">
                <p className="font-medium">{e.course.title}</p>
                <StatusBadge status={e.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                Access: {e.expiresAt ? `Until ${formatDate(e.expiresAt)}` : "Lifetime"}
                {" · "}Enrolled {formatDate(e.enrolledAt)}
              </p>
            </Card>
          ))}
          <Card className="gap-3 p-5">
            <p className="text-sm text-muted-foreground">
              Your access is granted through your enrollment. For any questions
              about your access, reach out to our team.
            </p>
            <Button
              variant="outline"
              className="w-fit"
              render={<Link href="/prototype/member/help" />}
            >
              <LifeBuoy />
              Contact support
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}

function Field({
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
