'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type {
  DomainRow,
  DomainSaveResult,
  VerifyResult,
} from '@/app/(admin)/admin/settings/domain-actions'

interface DomainCardProps {
  initialDomains: DomainRow[]
  apexDomain: string
  claimAction: (fd: FormData) => Promise<DomainSaveResult>
  removeAction: (id: string) => Promise<DomainSaveResult>
  startCustomAction: (fd: FormData) => Promise<DomainSaveResult>
  verifyAction: (id: string) => Promise<VerifyResult>
}

export function DomainCard({
  initialDomains,
  apexDomain,
  claimAction,
  removeAction,
  startCustomAction,
  verifyAction,
}: DomainCardProps) {
  const [domains, setDomains] = useState(initialDomains)
  const [claiming, startClaim] = useTransition()
  const [customPending, startCustom] = useTransition()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Domains</CardTitle>
        <CardDescription>
          Reach your tenant at a managed subdomain of{' '}
          <span className="font-mono">{apexDomain}</span>, or point
          your own hostname at the platform.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {domains.length > 0 && (
          <div className="space-y-2">
            <Label>Current domains</Label>
            <ul className="space-y-3">
              {domains.map((d) => (
                <DomainRowView
                  key={d.id}
                  domain={d}
                  onRemoved={() =>
                    setDomains((cur) => cur.filter((x) => x.id !== d.id))
                  }
                  onUpdated={(next) =>
                    setDomains((cur) =>
                      cur.map((x) => (x.id === d.id ? next : x)),
                    )
                  }
                  removeAction={removeAction}
                  verifyAction={verifyAction}
                />
              ))}
            </ul>
          </div>
        )}

        {/* Managed subdomain */}
        <form
          action={(fd) => {
            startClaim(async () => {
              const result = await claimAction(fd)
              if (result.ok && result.domain) {
                setDomains((cur) => [result.domain!, ...cur])
                toast.success(`${result.domain.hostname} is live`)
                ;(
                  document.getElementById('claim-managed-form') as
                    | HTMLFormElement
                    | null
                )?.reset()
              } else {
                toast.error(result.error ?? 'Could not claim subdomain')
              }
            })
          }}
          id="claim-managed-form"
          className="space-y-2"
        >
          <Label htmlFor="managedSlug">Claim a managed subdomain</Label>
          <div className="flex items-center gap-2">
            <Input
              id="managedSlug"
              name="slug"
              placeholder="acme"
              // Loose client-side pattern (browsers reject the tighter
              // regex in the newer `v` flag mode). The server action
              // enforces the strict shape via SLUG_PATTERN.
              pattern="[a-z0-9-]+"
              autoComplete="off"
              className="max-w-[220px]"
              required
            />
            <span className="font-mono text-sm text-muted-foreground">
              .{apexDomain}
            </span>
            <Button type="submit" disabled={claiming}>
              {claiming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Claiming…
                </>
              ) : (
                'Claim'
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Lowercase letters, digits, and dashes. Auto-verified — the
            platform's wildcard cert covers it, no DNS setup needed.
          </p>
        </form>

        {/* Custom domain */}
        <form
          action={(fd) => {
            startCustom(async () => {
              const result = await startCustomAction(fd)
              if (result.ok && result.domain) {
                setDomains((cur) => [result.domain!, ...cur])
                toast.success(
                  `Added ${result.domain.hostname} — publish the TXT record shown, then click Verify.`,
                )
                ;(
                  document.getElementById('add-custom-form') as
                    | HTMLFormElement
                    | null
                )?.reset()
              } else {
                toast.error(result.error ?? 'Could not add domain')
              }
            })
          }}
          id="add-custom-form"
          className="space-y-2"
        >
          <Label htmlFor="customHostname">Add a custom domain</Label>
          <div className="flex items-center gap-2">
            <Input
              id="customHostname"
              name="hostname"
              placeholder="portal.acme.com"
              autoComplete="off"
              className="max-w-[320px]"
              required
            />
            <Button type="submit" disabled={customPending}>
              {customPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding…
                </>
              ) : (
                'Add'
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            You'll be shown TXT + CNAME records to publish at your DNS
            provider. Verification is a single button click.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────
// Per-row view (handles the verify + remove UX for one domain)
// ────────────────────────────────────────────

function DomainRowView({
  domain,
  onRemoved,
  onUpdated,
  removeAction,
  verifyAction,
}: {
  domain: DomainRow
  onRemoved: () => void
  onUpdated: (next: DomainRow) => void
  removeAction: (id: string) => Promise<DomainSaveResult>
  verifyAction: (id: string) => Promise<VerifyResult>
}) {
  const [removing, startRemove] = useTransition()
  const [verifying, startVerify] = useTransition()

  const status = statusLabel(domain)

  return (
    <li className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm">{domain.hostname}</span>
          {domain.isPrimary && (
            <Badge variant="secondary" className="text-xs">
              primary
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            {domain.kind === 'MANAGED_SUBDOMAIN' ? 'managed' : 'custom'}
          </Badge>
          <span
            className={`text-xs ${
              status.tone === 'success'
                ? 'text-emerald-500'
                : status.tone === 'warning'
                  ? 'text-amber-500'
                  : 'text-muted-foreground'
            }`}
          >
            {status.tone === 'success' && (
              <Check className="mr-1 inline h-3 w-3" />
            )}
            {status.text}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {domain.kind === 'CUSTOM' && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Verify"
              disabled={verifying}
              onClick={() => {
                startVerify(async () => {
                  const result = await verifyAction(domain.id)
                  if (result.ok && result.domain) {
                    onUpdated(result.domain)
                    if (result.stage === 'live') {
                      toast.success(`${domain.hostname} is live`)
                    } else if (result.stage === 'ssl-pending') {
                      toast.message('Verified — waiting for SSL cert')
                    } else if (result.stage === 'vercel-not-configured') {
                      toast.message(
                        'TXT verified. Vercel API not configured — attach the domain manually.',
                      )
                    } else {
                      toast.message('Verified')
                    }
                  } else {
                    toast.error(result.error ?? 'Verification failed')
                  }
                })
              }}
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${domain.hostname}`}
            disabled={removing}
            onClick={() => {
              startRemove(async () => {
                const result = await removeAction(domain.id)
                if (result.ok) {
                  onRemoved()
                  toast.success('Domain removed')
                } else {
                  toast.error(result.error ?? 'Could not remove')
                }
              })
            }}
          >
            {removing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {domain.kind === 'CUSTOM' && domain.verifiedAt === null && (
        <div className="mt-3 space-y-2 rounded-md border bg-background/60 p-3 text-xs">
          <p className="font-medium">Publish these DNS records</p>
          <div className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-1 font-mono">
            <span className="text-muted-foreground">TXT</span>
            <span className="break-all">
              _kondense-verify.{domain.hostname} = {domain.verificationToken}
            </span>
            <span className="text-muted-foreground">CNAME</span>
            <span>{domain.hostname} → cname.vercel-dns.com.</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            After both records are live, click the refresh icon above to
            verify. SSL issuance follows automatically.
          </p>
        </div>
      )}
    </li>
  )
}

function statusLabel(d: DomainRow): { text: string; tone: 'success' | 'warning' | 'neutral' } {
  if (d.kind === 'MANAGED_SUBDOMAIN') {
    return d.verifiedAt
      ? { text: 'verified', tone: 'success' }
      : { text: 'unverified', tone: 'warning' }
  }
  // CUSTOM
  if (!d.verifiedAt) return { text: 'verification pending', tone: 'warning' }
  if (!d.sslIssuedAt) return { text: 'SSL pending', tone: 'warning' }
  return { text: 'live', tone: 'success' }
}
