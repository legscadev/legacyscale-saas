import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface AvatarGroupProps {
  users: Array<{ name?: string | null; avatarUrl?: string | null }>
  max?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
}

const overlapStyles = {
  sm: '-ml-2',
  md: '-ml-3',
  lg: '-ml-4',
}

function initials(name?: string | null): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function AvatarGroup({
  users,
  max = 5,
  size = 'md',
  className,
}: AvatarGroupProps) {
  const visible = users.slice(0, max)
  const remaining = users.length - visible.length

  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((user, index) => (
        <Avatar
          key={index}
          className={cn(
            sizeStyles[size],
            'border-2 border-background',
            index > 0 && overlapStyles[size]
          )}
        >
          <AvatarImage src={user.avatarUrl ?? undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            sizeStyles[size],
            overlapStyles[size],
            'flex items-center justify-center rounded-full border-2 border-background bg-muted font-medium text-muted-foreground'
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  )
}
