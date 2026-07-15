import { PageHeader } from '@/components/shared'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { BrandingCard } from '@/components/admin/settings/branding-card'
import { DiscordWebhookCard } from '@/components/admin/settings/discord-webhook-card'
import { getActiveCompany } from '@/lib/tenancy/active-company'
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
  clearBrandingAction,
  getCurrentBrandingAction,
  updateBrandingAction,
  uploadBrandingAssetAction,
} from './branding-actions'
// Domain actions + DomainCard are intentionally left imported-but-not-
// used-here would fail lint, so they're removed until the tab is
// brought back. The action file itself is untouched so the API stays
// live for future work.

export default async function AdminSettingsPage() {
  // Domains tab is hidden for now — the surface + Vercel-side plumbing
  // stays wired up, but the fetch calls (listDomainsAction /
  // getPlatformApexAction) are skipped so we don't pay for them on
  // every settings render. Re-enable by restoring both the awaits and
  // the <TabsTrigger value="domains"/> + <TabsContent value="domains"/>
  // pair below.
  const [discordSetting, achievementsSetting, currentBranding, activeCompany] =
    await Promise.all([
      getDiscordWebhookSettingAction(),
      getAchievementsWebhookSettingAction(),
      getCurrentBrandingAction(),
      getActiveCompany(),
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
            tenantName={activeCompany?.name ?? null}
            action={updateBrandingAction}
            clearAction={clearBrandingAction}
            uploadAction={uploadBrandingAssetAction}
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
