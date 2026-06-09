"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Compass,
  LayoutGrid,
  Palette,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"

const LINKS = [
  { label: "Prototype Home", href: "/prototype", icon: LayoutGrid },
  { label: "Admin Console", href: "/prototype/admin/dashboard", icon: ShieldCheck },
  { label: "Member App", href: "/prototype/member/dashboard", icon: UserRound },
  { label: "Design System", href: "/prototype/design-system", icon: Palette },
]

/** Always-available floating navigator for jumping across the prototype. */
export function PrototypeNavigator() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Hide on the member side so the member app demos as if it were the
  // real product (no floating "demo affordance" in the screenshot).
  if (pathname?.startsWith("/prototype/member")) return null

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2 print:hidden">
      {open ? (
        <div className="w-56 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Prototype
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close navigator"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="p-1.5">
            {LINKS.map((l) => {
              const Icon = l.icon
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon className="size-4 text-muted-foreground" />
                  {l.label}
                </Link>
              )
            })}
          </div>
        </div>
      ) : null}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        )}
      >
        <Compass className="size-4" />
        Prototype
      </button>
    </div>
  )
}
