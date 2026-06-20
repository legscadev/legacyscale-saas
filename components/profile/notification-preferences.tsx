'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { updateNotificationPreferencesAction } from '@/lib/actions/notification-preferences'

interface NotificationPreferencesProps {
  initial: {
    notifyAnnouncementEmail: boolean
    notifyAnnouncementDiscord: boolean
  }
}

export function NotificationPreferences({ initial }: NotificationPreferencesProps) {
  const [email, setEmail] = useState(initial.notifyAnnouncementEmail)
  const [discord, setDiscord] = useState(initial.notifyAnnouncementDiscord)
  const [pending, startTransition] = useTransition()

  function update(input: { notifyAnnouncementEmail?: boolean; notifyAnnouncementDiscord?: boolean }) {
    const previousEmail = email
    const previousDiscord = discord
    if (input.notifyAnnouncementEmail !== undefined) setEmail(input.notifyAnnouncementEmail)
    if (input.notifyAnnouncementDiscord !== undefined) setDiscord(input.notifyAnnouncementDiscord)
    startTransition(async () => {
      const res = await updateNotificationPreferencesAction(input)
      if (!res.ok) {
        setEmail(previousEmail)
        setDiscord(previousDiscord)
        toast.error(res.error ?? 'Could not save preferences')
        return
      }
      toast.success('Preferences saved')
    })
  }

  return (
    <Card className="gap-4 p-6">
      <div>
        <h2 className="text-base font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Pick how you want to hear about announcements.
        </p>
      </div>

      <div className="space-y-3">
        <Row
          title="Email me when an announcement is published"
          body="We only send when the admin opts in to the email blast."
          checked={email}
          disabled={pending}
          onChange={(checked) => update({ notifyAnnouncementEmail: checked })}
        />
        <Row
          title="Notify me on Discord"
          body="Only relevant if you're on the Kondense Discord server. This is a global opt-out — the Discord crosspost is shared, so disabling does NOT skip you specifically yet."
          checked={discord}
          disabled={pending}
          onChange={(checked) => update({ notifyAnnouncementDiscord: checked })}
        />
      </div>
    </Card>
  )
}

function Row({
  title,
  body,
  checked,
  disabled,
  onChange,
}: {
  title: string
  body: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 p-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium leading-none">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        disabled={disabled}
      />
    </label>
  )
}
