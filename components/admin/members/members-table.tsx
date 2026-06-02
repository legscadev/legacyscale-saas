import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SectionCard, StatusBadge } from '@/components/shared'
import { MemberActionsMenu } from './member-actions-menu'
import type { MemberListItem } from '@/lib/services/member-service'

interface MembersTableProps {
  members: MemberListItem[]
  currentUserId: string
}

function getInitials(name: string | null, email: string): string {
  const source = name?.trim() || email
  const parts = source.split(/\s+/)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

function formatJoined(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function MembersTable({ members, currentUserId }: MembersTableProps) {
  return (
    <SectionCard flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="w-12 text-right pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="pl-4">
                <div className="flex items-center gap-3">
                  <Avatar size="sm">
                    {m.avatarUrl ? (
                      <AvatarImage src={m.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback>
                      {getInitials(m.name, m.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {m.name ?? m.email.split('@')[0]}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.email}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={m.role} />
              </TableCell>
              <TableCell>
                <StatusBadge status={m.isActive ? 'ACTIVE' : 'PAUSED'} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatJoined(m.createdAt)}
              </TableCell>
              <TableCell className="pr-4 text-right">
                <MemberActionsMenu
                  memberId={m.id}
                  isActive={m.isActive}
                  isSelf={m.id === currentUserId}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  )
}
