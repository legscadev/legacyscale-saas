import { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GradientTextProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  variant?: 'brand' | 'silver' | 'ember'
}

export function GradientText({
  children,
  variant = 'silver',
  className,
  ...rest
}: GradientTextProps) {
  const gradients = {
    brand:
      'bg-[linear-gradient(110deg,#ff8a8a_0%,#ff4a4a_30%,#d11a1a_70%,#ffb4b4_100%)] bg-clip-text text-transparent',
    silver:
      'bg-[linear-gradient(110deg,#ffffff_0%,#ffffff_30%,#bdbdbd_60%,#ffffff_100%)] bg-clip-text text-transparent',
    ember:
      'bg-[linear-gradient(110deg,#ffd5a8_0%,#ff8a4a_40%,#ff4a4a_75%,#ffb47a_100%)] bg-clip-text text-transparent',
  }

  return (
    <span className={cn(gradients[variant], className)} {...rest}>
      {children}
    </span>
  )
}
