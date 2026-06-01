'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlowButton } from '../shared/glow-button'

const NAV_LINKS = [
  { label: 'Inside', href: '#inside' },
  { label: 'Founder', href: '#founder' },
  { label: 'Features', href: '#features' },
]

export function MarketingNav() {
  const [open, setOpen] = useState(false)
  const { scrollY } = useScroll()
  const bg = useTransform(scrollY, [0, 80], ['rgba(8,7,10,0)', 'rgba(8,7,10,0.7)'])
  const border = useTransform(
    scrollY,
    [0, 80],
    ['rgba(255,255,255,0)', 'rgba(255,255,255,0.08)'],
  )
  const blur = useTransform(scrollY, [0, 80], ['blur(0px)', 'blur(18px)'])

  return (
    <motion.header
      style={{ backgroundColor: bg, borderBottomColor: border, backdropFilter: blur }}
      className="fixed inset-x-0 top-0 z-50 border-b transition-colors"
    >
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-6 px-5 sm:px-6 lg:px-10">
        {/* LEFT — logo + wordmark */}
        <Link
          href="/"
          className="group flex items-center gap-2.5"
        >
          <span className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-[#15080a]">
            <Image
              src="/legacy-scale-logo.png"
              alt="Legacy Scale"
              width={72}
              height={72}
              priority
              className="relative z-10 h-full w-full scale-110 object-contain mix-blend-screen"
            />
            <span className="absolute inset-0 -z-10 rounded-full bg-[#ff4a4a] opacity-25 blur-md transition-opacity duration-300 group-hover:opacity-60" />
          </span>
          <span
            className="hidden text-sm font-semibold tracking-tight text-white sm:inline"
            style={{ letterSpacing: '-0.01em' }}
          >
            Legacy Scale
          </span>
        </Link>

        {/* CENTER — true center via grid column */}
        <nav className="hidden items-center justify-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative rounded-full px-4 py-1.5 text-sm text-white/60 transition-colors hover:text-white"
            >
              <span className="relative z-10">{link.label}</span>
              <span className="absolute inset-0 -z-10 rounded-full bg-white/[0.04] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            </Link>
          ))}
        </nav>

        {/* RIGHT — login */}
        <div className="hidden items-center justify-end md:flex">
          <GlowButton
            href="/login"
            variant="solid"
            className="px-4 py-1.5 text-sm font-medium"
            magnetic={false}
          >
            Login
          </GlowButton>
        </div>

        {/* Mobile menu button */}
        <button
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="col-start-3 grid h-9 w-9 place-items-center rounded-md border border-white/[0.08] bg-white/[0.04] text-white md:hidden"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <motion.div
        initial={false}
        animate={{
          height: open ? 'auto' : 0,
          opacity: open ? 1 : 0,
        }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={cn('overflow-hidden border-t border-white/[0.06] md:hidden')}
      >
        <div className="flex flex-col gap-1 px-5 py-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-3 flex items-center justify-end">
            <GlowButton
              href="/login"
              variant="ghost"
              className="px-4 py-1.5 text-sm font-medium"
              magnetic={false}
            >
              Login
            </GlowButton>
          </div>
        </div>
      </motion.div>
    </motion.header>
  )
}
