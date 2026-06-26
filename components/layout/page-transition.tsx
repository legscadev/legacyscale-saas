'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

/**
 * Wraps route children with a subtle fade + 4px slide-up that fires
 * on every soft navigation. Keyed on pathname so AnimatePresence's
 * exit → enter cycle runs each time the route changes.
 *
 * `initial={false}` on AnimatePresence skips the very first mount
 * (page load) — only subsequent client-side navigations animate.
 * `mode="wait"` keeps the exit/enter sequential so the outgoing
 * route fades out before the new one fades in.
 *
 * The animation is intentionally short (180ms ease-out) — too long
 * makes navigation feel sluggish; too short feels jumpy.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
