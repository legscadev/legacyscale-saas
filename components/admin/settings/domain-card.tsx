'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Trash2 } from 'lucide-react'
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
} from '@/app/(admin)/admin/settings/domain-actions'

interface DomainCardProps {
  initialDomains: DomainRow[]
  apexDomain: string
  claimAction: (fd: FormData) => Promise<DomainSaveResult>
  removeAction: (id: string) => Promise<DomainSaveResult>
}

export function DomainCard({
  initialDomains,
  apexDomain,
  claimAction,
  removeAction,
}: DomainCardProps) {
  const [domains, setDomains] = useState(initialDomains)
  const [claiming, startClaim] = useTransition()
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removing, startRemove] = useTransition()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Domains</CardTitle>
        <CardDescription>
          Reach your tenant at a managed subdomain of{' '}
          <span className="font-mono">{apexDomain}</span>. Custom
          domains (e.g. <span className="font-mono">portal.acme.com</span>
          ) are in the next task.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {domains.length > 0 && (
          <div className="space-y-2">
            <Label>Current domains</Label>
            <ul className="space-y-2">
              {domains.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{d.hostname}</span>
                    {d.isPrimary && (
                      <Badge variant="secondary" className="text-xs">
                        primary
                      </Badge>
                    )}
                    {d.verifiedAt ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-500">
                        <Check className="h-3 w-3" /> verified
                      </span>
                    ) : (
                      <span className="text-xs text-amber-500">
                        verification pending
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {d.kind === 'MANAGED_SUBDOMAIN' ? 'managed' : 'custom'}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${d.hostname}`}
                    disabled={removing && removingId === d.id}
                    onClick={() => {
                      setRemovingId(d.id)
                      startRemove(async () => {
                        const result = await removeAction(d.id)
                        if (result.ok) {
                          setDomains((cur) =>
                            cur.filter((x) => x.id !== d.id),
                          )
                          toast.success('Domain removed')
                        } else {
                          toast.error(result.error ?? 'Could not remove')
                        }
                        setRemovingId(null)
                      })
                    }}
                  >
                    {removing && removingId === d.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form
          action={(fd) => {
            startClaim(async () => {
              const result = await claimAction(fd)
              if (result.ok && result.domain) {
                setDomains((cur) => [result.domain!, ...cur])
                toast.success(`${result.domain.hostname} is live`)
                // Reset the input
                const form = document.getElementById(
                  'claim-managed-form',
                ) as HTMLFormElement | null
                form?.reset()
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
      </CardContent>
    </Card>
  )
}
