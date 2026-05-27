import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
}

export function ProgressBar({
  value,
  max = 100,
  showLabel = false,
  size = 'md',
  className,
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-muted',
          sizeStyles[size]
        )}
      >
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

interface CourseProgressProps {
  completed: number
  total: number
  className?: string
}

export function CourseProgress({
  completed,
  total,
  className,
}: CourseProgressProps) {
  const percentage = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">
          {completed} of {total} lessons
        </span>
        <span className="font-medium text-primary">
          {Math.round(percentage)}%
        </span>
      </div>
      <ProgressBar value={percentage} size="sm" />
    </div>
  )
}
