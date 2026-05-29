import Image from 'next/image'
import Link from 'next/link'

const FOOTER_LINKS = [
  {
    title: 'Platform',
    links: [
      { label: 'Course library', href: '#features' },
      { label: 'Live trainings', href: '#features' },
      { label: 'Private community', href: '#features' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Founder', href: '#founder' },
      { label: 'Contact', href: '#' },
    ],
  },
  {
    title: 'Access',
    links: [{ label: 'Login', href: '#' }],
  },
]

export function MarketingFooter() {
  return (
    <footer className="relative border-t border-white/[0.06] bg-[#08070a]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link
              href="/"
              className="group flex items-center gap-2.5 text-sm font-semibold tracking-tight text-white"
            >
              <span className="relative inline-flex h-10 w-10 items-center justify-center">
                <Image
                  src="/legacy-scale-logo.png"
                  alt="Legacy Scale"
                  width={80}
                  height={80}
                  className="relative z-10 h-full w-full object-contain"
                />
                <span className="absolute inset-0 -z-10 rounded-full bg-[#ff4a4a] opacity-20 blur-lg transition-opacity duration-300 group-hover:opacity-50" />
              </span>
              <span>Legacy Scale</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-white/50">
              The members platform for marketing fulfillment arbitrage. Built
              and operated by Keanu Vasquez — every part of the Legacy Scale
              program, behind one login.
            </p>
          </div>

          {FOOTER_LINKS.map((col) => (
            <div key={col.title}>
              <div className="text-xs font-medium tracking-wider text-white/40 uppercase">
                {col.title}
              </div>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/70 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-white/[0.06] pt-8 text-xs text-white/40 sm:flex-row sm:items-center">
          <div>© {new Date().getFullYear()} Legacy Scale. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <Link href="#" className="transition-colors hover:text-white/70">
              Privacy
            </Link>
            <Link href="#" className="transition-colors hover:text-white/70">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
