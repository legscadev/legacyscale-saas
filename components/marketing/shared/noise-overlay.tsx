import { cn } from '@/lib/utils'

const noiseSvg = `<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.55'/></svg>`

export function NoiseOverlay({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 mix-blend-soft-light opacity-[0.08]',
        className,
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,${noiseSvg}")`,
        backgroundSize: '200px 200px',
      }}
    />
  )
}
