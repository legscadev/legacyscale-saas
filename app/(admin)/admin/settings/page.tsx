import { PageHeader } from '@/components/shared'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { BrandingCard } from '@/components/admin/settings/branding-card'
import { DiscordWebhookCard } from '@/components/admin/settings/discord-webhook-card'
import {
  getAchievementsWebhookSettingAction,
  getDiscordWebhookSettingAction,
  revealAchievementsWebhookAction,
  revealDiscordWebhookAction,
  testAchievementsWebhookAction,
  testDiscordWebhookAction,
  updateAchievementsWebhookAction,
  updateDiscordWebhookAction,
} from './actions'
import {
  getCurrentBrandingAction,
  updateBrandingAction,
} from './branding-actions'

export default async function AdminSettingsPage() {
  const [discordSetting, achievementsSetting, currentBranding] =
    await Promise.all([
      getDiscordWebhookSettingAction(),
      getAchievementsWebhookSettingAction(),
      getCurrentBrandingAction(),
    ])

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Configure platform settings" />

      <Tabs defaultValue="branding" className="gap-6">
        <TabsList>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <BrandingCard
            initial={currentBranding}
            action={updateBrandingAction}
          />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <DiscordWebhookCard
            initialSetting={discordSetting}
            title="Discord webhook — Announcements"
            description="Crossposts new announcements to your Discord channel. Get a URL from Discord → Channel Settings → Integrations → Webhooks."
            inputId="discordWebhookUrl"
            notConfiguredHint='No webhook configured. The "Crosspost to Discord" option in announcements will be disabled.'
            clearAlert={{
              title: 'Clear announcement webhook?',
              description:
                'Announcement crossposts to Discord will stop working until a new webhook URL is set. Existing posts in the channel are not affected.',
            }}
            actions={{
              reveal: revealDiscordWebhookAction,
              update: updateDiscordWebhookAction,
              test: testDiscordWebhookAction,
            }}
          />

          <DiscordWebhookCard
            initialSetting={achievementsSetting}
            title="Discord webhook — Achievements"
            description="Posts a celebration embed to your achievements channel each time a member completes a course. Use a separate channel from announcements so course-completion noise stays focused."
            inputId="discordAchievementsWebhookUrl"
            notConfiguredHint="No webhook configured. Course-completion posts to Discord will not fire until a URL is set."
            clearAlert={{
              title: 'Clear achievements webhook?',
              description:
                'Course-completion crossposts to Discord will stop firing until a new webhook URL is set. Already-posted celebrations are not affected.',
            }}
            actions={{
              reveal: revealAchievementsWebhookAction,
              update: updateAchievementsWebhookAction,
              test: testAchievementsWebhookAction,
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
