'use client'

import { useState, useTransition } from 'react'
import { Eye, EyeOff, Loader2, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

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
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  type DiscordWebhookSetting,
  revealDiscordWebhookAction,
  testDiscordWebhookAction,
  updateDiscordWebhookAction,
} from '@/app/(admin)/admin/settings/actions'

interface DiscordWebhookCardProps {
  initialSetting: DiscordWebhookSetting
}

type Mode = 'view' | 'edit'

export function DiscordWebhookCard({ initialSetting }: DiscordWebhookCardProps) {
  const [setting, setSetting] = useState(initialSetting)
  const [mode, setMode] = useState<Mode>('view')
  // Candidate URL while editing — never persisted until Save.
  const [candidate, setCandidate] = useState('')
  // Revealed URL for the eye-icon toggle in view mode. Empty when
  // hidden; populated on demand from the reveal action.
  const [revealed, setRevealed] = useState('')
  const [isSaving, startSaving] = useTransition()
  const [isTesting, startTesting] = useTransition()
  const [isClearing, startClearing] = useTransition()
  const [isRevealing, startRevealing] = useTransition()
  const [clearOpen, setClearOpen] = useState(false)

  function enterEdit() {
    setCandidate('')
    setRevealed('')
    setMode('edit')
  }

  function cancelEdit() {
    setCandidate('')
    setMode('view')
  }

  function handleReveal() {
    if (revealed) {
      setRevealed('')
      return
    }
    startRevealing(async () => {
      const result = await revealDiscordWebhookAction()
      if (!result.ok) {
        toast.error(result.error ?? 'Could not reveal webhook URL')
        return
      }
      setRevealed(result.url)
    })
  }

  function handleSave() {
    if (candidate.trim() === '') {
      toast.error('Paste a webhook URL or click Cancel')
      return
    }
    startSaving(async () => {
      const fd = new FormData()
      fd.set('webhookUrl', candidate)
      const result = await updateDiscordWebhookAction(fd)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not save webhook URL')
        return
      }
      toast.success('Webhook saved')
      setSetting({
        configured: true,
        masked: maskClient(candidate.trim()),
      })
      setCandidate('')
      setRevealed('')
      setMode('view')
    })
  }

  function handleClearConfirmed() {
    startClearing(async () => {
      const fd = new FormData()
      fd.set('webhookUrl', '')
      const result = await updateDiscordWebhookAction(fd)
      if (!result.ok) {
        toast.error(result.error ?? 'Could not clear webhook URL')
        return
      }
      toast.success('Webhook cleared')
      setSetting({ configured: false, masked: null })
      setRevealed('')
      setClearOpen(false)
    })
  }

  function handleTest() {
    startTesting(async () => {
      const fd = new FormData()
      if (mode === 'edit' && candidate.trim() !== '') {
        fd.set('webhookUrl', candidate)
      }
      const result = await testDiscordWebhookAction(fd)
      if (result.ok) {
        toast.success('Test message sent — check the Discord channel')
      } else {
        toast.error(result.error ?? 'Test failed')
      }
    })
  }

  const busy = isSaving || isTesting || isClearing || isRevealing

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Discord webhook
          <SourceBadge configured={setting.configured} />
        </CardTitle>
        <CardDescription>
          Used to crosspost announcements to your Discord channel.
          Get a URL from Discord → Channel Settings → Integrations → Webhooks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === 'view' ? (
          <ViewMode
            setting={setting}
            revealed={revealed}
            isRevealing={isRevealing}
            onReveal={handleReveal}
          />
        ) : (
          <EditMode
            candidate={candidate}
            onChange={setCandidate}
            disabled={busy}
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {mode === 'view' ? (
            <>
              <Button onClick={enterEdit} disabled={busy}>
                <Pencil className="mr-2 h-4 w-4" />
                {setting.configured ? 'Replace URL' : 'Set URL'}
              </Button>
              {setting.configured ? (
                <Button
                  variant="outline"
                  onClick={() => setClearOpen(true)}
                  disabled={busy}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={busy || !setting.configured}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing…
                  </>
                ) : (
                  'Test webhook'
                )}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleSave} disabled={busy}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={busy || candidate.trim() === ''}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing…
                  </>
                ) : (
                  'Test webhook'
                )}
              </Button>
              <Button variant="ghost" onClick={cancelEdit} disabled={busy}>
                Cancel
              </Button>
            </>
          )}
          <p className="text-xs text-muted-foreground">
            Test posts a real message to the channel.
          </p>
        </div>
      </CardContent>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Discord webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Announcement crossposts to Discord will stop working
              until a new webhook URL is set. Existing posts in the
              channel are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleClearConfirmed()
              }}
              disabled={isClearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isClearing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Clearing…
                </>
              ) : (
                'Clear webhook'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

interface ViewModeProps {
  setting: DiscordWebhookSetting
  revealed: string
  isRevealing: boolean
  onReveal: () => void
}

function ViewMode({ setting, revealed, isRevealing, onReveal }: ViewModeProps) {
  return (
    <div className="space-y-2">
      <Label>Webhook URL</Label>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={
            !setting.configured
              ? ''
              : revealed
                ? revealed
                : '•••••••••••••••••••••••••••••••••••••••••'
          }
          placeholder={
            setting.configured ? '' : 'No webhook configured'
          }
          className="font-mono text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onReveal}
          disabled={!setting.configured || isRevealing}
          aria-label={revealed ? 'Hide webhook URL' : 'Show webhook URL'}
        >
          {isRevealing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : revealed ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {setting.configured
          ? `Masked: ${setting.masked}`
          : 'No webhook configured. The "Crosspost to Discord" option in announcements will be disabled.'}
      </p>
    </div>
  )
}

interface EditModeProps {
  candidate: string
  onChange: (v: string) => void
  disabled: boolean
}

function EditMode({ candidate, onChange, disabled }: EditModeProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="discordWebhookUrl">Webhook URL</Label>
      <Input
        id="discordWebhookUrl"
        type="url"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://discord.com/api/webhooks/…"
        value={candidate}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoFocus
        className="font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Paste the full webhook URL. Use Test webhook to confirm it works
        before saving.
      </p>
    </div>
  )
}

function SourceBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <Badge variant="secondary">Configured</Badge>
  ) : (
    <Badge variant="destructive">Not configured</Badge>
  )
}

// Mirror of the server's masking so the optimistic post-save view
// matches what the server will return on the next render. Kept in
// sync with maskWebhookUrl in lib/services/app-setting-service.ts.
function maskClient(url: string): string {
  const match = url.match(
    /^(https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+)\/[\w-]+$/,
  )
  return match ? `${match[1]}/****` : '****'
}
