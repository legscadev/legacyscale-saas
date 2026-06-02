'use client'

import {
  Edit3,
  KeyRound,
  Mail,
  ShieldCheck,
  UserX,
  Archive,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { StatusBadge } from '@/components/shared'
import type { MemberListItem } from '@/lib/services/member-service'

interface MemberDrawerProps {
  member: MemberListItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function getInitials(name: string | null, email: string): string {
  const source = name?.trim() || email
  const parts = source.split(/\s+/)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function formatDate(date: Date | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(date)
}

export function MemberDrawer({
  member,
  open,
  onOpenChange,
}: MemberDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {member ? (
          <>
            <SheetHeader>
              <div className="flex items-start gap-3">
                <Avatar size="lg">
                  {member.avatarUrl ? (
                    <AvatarImage src={member.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback>
                    {getInitials(member.name, member.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate">
                    {member.name ?? member.email.split('@')[0]}
                  </SheetTitle>
                  <SheetDescription className="truncate">
                    {member.email}
                  </SheetDescription>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={member.role} />
                    <StatusBadge
                      status={
                        member.deletedAt
                          ? 'ARCHIVED'
                          : member.isActive
                            ? 'ACTIVE'
                            : 'PAUSED'
                      }
                    />
                  </div>
                </div>
              </div>
            </SheetHeader>

            <SheetBody>
              <Section title="Activity">
                <Row label="Last login" value={formatDate(member.lastLoginAt)} />
                <Row label="Joined" value={formatDate(member.createdAt)} />
              </Section>

              <Section title="Actions">
                <div className="grid gap-1.5">
                  <ActionRow
                    icon={Edit3}
                    label="Edit details"
                    helper="Update name and role"
                  />
                  <ActionRow
                    icon={KeyRound}
                    label="Send password reset"
                    helper="Email a recovery link"
                  />
                  <ActionRow
                    icon={Mail}
                    label="Resend welcome email"
                    helper="If they didn't receive it"
                  />
                  {member.isActive ? (
                    <ActionRow
                      icon={UserX}
                      label="Suspend access"
                      helper="Sign them out, block sign-in"
                      destructive
                    />
                  ) : (
                    <ActionRow
                      icon={ShieldCheck}
                      label="Reactivate"
                      helper="Restore platform access"
                    />
                  )}
                  <ActionRow
                    icon={Archive}
                    label="Archive"
                    helper="Move out of the active roster"
                    destructive
                  />
                </div>
              </Section>
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

function ActionRow({
  icon: Icon,
  label,
  helper,
  destructive,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  helper: string
  destructive?: boolean
}) {
  return (
    <Button
      variant="ghost"
      disabled
      className="h-auto justify-start gap-3 px-3 py-2.5 text-left"
    >
      <Icon className={destructive ? 'size-4 text-destructive' : 'size-4'} />
      <span className="flex-1">
        <span
          className={destructive ? 'block text-destructive' : 'block'}
        >
          {label}
        </span>
        <span className="block text-xs font-normal text-muted-foreground">
          {helper}
        </span>
      </span>
    </Button>
  )
}
