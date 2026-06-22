import { PageHeader } from '@/components/shared'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { DiscordWebhookCard } from '@/components/admin/settings/discord-webhook-card'
import { getDiscordWebhookSettingAction } from './actions'

export default async function AdminSettingsPage() {
  const discordSetting = await getDiscordWebhookSettingAction()

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure platform settings" />

      <Tabs defaultValue="general" className="gap-6">
        <TabsList>
          <TabsTrigger value="general">Settings</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Basic platform configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platformName">Platform Name</Label>
                <Input id="platformName" defaultValue="Kondense" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input
                  id="supportEmail"
                  type="email"
                  defaultValue="support@kondense.ai"
                />
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <DiscordWebhookCard initialSetting={discordSetting} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
