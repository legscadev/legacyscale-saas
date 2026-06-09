"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Search,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Dialog, DialogPortal } from "@/components/ui/dialog"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

interface Command {
  label: string
  group: string
  href: string
  icon: LucideIcon
}

const COMMANDS: Command[] = [
  { label: "Admin · Overview", group: "Admin", href: "/prototype/admin/dashboard", icon: LayoutDashboard },
  { label: "Admin · Analytics", group: "Admin", href: "/prototype/admin/analytics", icon: BarChart3 },
  { label: "Admin · Courses", group: "Admin", href: "/prototype/admin/courses", icon: GraduationCap },
  { label: "Admin · Members", group: "Admin", href: "/prototype/admin/members", icon: Users },
  { label: "Admin · Enrollments", group: "Admin", href: "/prototype/admin/enrollments", icon: Ticket },
  { label: "Admin · Announcements", group: "Admin", href: "/prototype/admin/announcements", icon: Megaphone },
  { label: "Member · Dashboard", group: "Member", href: "/prototype/member/dashboard", icon: LayoutDashboard },
  { label: "Member · My Courses", group: "Member", href: "/prototype/member/courses", icon: BookOpen },
  { label: "Member · Continue learning", group: "Member", href: "/prototype/member/learn/l-5", icon: ArrowRight },
]

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener("open-command-palette", onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("open-command-palette", onOpen)
    }
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COMMANDS
    return COMMANDS.filter((c) => c.label.toLowerCase().includes(q))
  }, [query])

  const go = (href: string) => {
    setOpen(false)
    setQuery("")
    router.push(href)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0" />
        <DialogPrimitive.Popup className="fixed top-[20%] left-1/2 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
          <DialogPrimitive.Title className="sr-only">
            Command palette
          </DialogPrimitive.Title>
          <div className="flex items-center gap-2.5 border-b px-3.5">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search screens and actions…"
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5 scrollbar-thin">
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No results for “{query}”
              </p>
            ) : (
              results.map((c) => {
                const Icon = c.icon
                return (
                  <button
                    key={c.href + c.label}
                    onClick={() => go(c.href)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="flex-1">{c.label}</span>
                    <ArrowRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                )
              })
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
