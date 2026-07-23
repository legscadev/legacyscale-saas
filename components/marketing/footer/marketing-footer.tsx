import Image from 'next/image'
import Link from 'next/link'

const FOOTER_LINKS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Contact', href: 'mailto:hello@kondense.ai' },
    ],
  },
  {
    title: 'Access',
    links: [{ label: 'Login', href: '/login' }],
  },
]

export function MarketingFooter() {
  return (
    <footer className="relative bg-[#08070a]">
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
              <span className="inline-flex h-10 w-10 items-center justify-center">
                <Image
                  src="/kondense-logo.png"
                  alt="Kondense"
                  width={80}
                  height={80}
                  className="h-full w-full object-contain"
                />
              </span>
              <span>Kondense</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-white/50">
              The members platform for creators, coaches, and course sellers.
              Course library, video hosting, and member portal — all behind
              your branded login.
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

        <div className="mt-16 flex flex-col items-start justify-between gap-4 pt-8 text-xs text-white/40 sm:flex-row sm:items-center">
          <div>© {new Date().getFullYear()} Kondense. All rights reserved.</div>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="transition-colors hover:text-white/70"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-white/70"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
