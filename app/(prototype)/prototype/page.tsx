import Link from "next/link"
import {
  ArrowRight,
  GraduationCap,
  Palette,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { BrandMark } from "@/components/prototype/shell/brand-mark"

const ADMIN_SCREENS = [
  "Dashboard & analytics",
  "Course builder (video / quiz / resource)",
  "Members & enrollments",
  "Announcements, settings, integrations",
]

const MEMBER_SCREENS = [
  "Continue-learning dashboard",
  "Lesson player, quizzes & notes",
  "My courses & progress",
  "Notifications, activity, account",
]

const EXTRAS = [
  { label: "Design System", href: "/prototype/design-system", icon: Palette },
  { label: "Onboarding", href: "/prototype/onboarding", icon: Sparkles },
  { label: "Sign in", href: "/prototype/auth/sign-in", icon: UserRound },
]

export default function PrototypeHome() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <BrandMark context="Product Prototype" />

        <div className="mt-10 max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" />
            High-fidelity clickable prototype
          </span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            The Legacy Scale platform,
            <br />
            visualized before we build.
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            A navigable mockup of the agency education platform — admin console
            and member app — built on real data flows from the MVP schema.
            Everything is clickable and powered by realistic mock data.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <RoleCard
            href="/prototype/admin/dashboard"
            icon={<ShieldCheck className="size-5" />}
            title="Admin Console"
            subtitle="For Keanu & coaches"
            screens={ADMIN_SCREENS}
          />
          <RoleCard
            href="/prototype/member/dashboard"
            icon={<GraduationCap className="size-5" />}
            title="Member App"
            subtitle="For agency students"
            screens={MEMBER_SCREENS}
          />
        </div>

        <div className="mt-10">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            More
          </p>
          <div className="flex flex-wrap gap-2">
            {EXTRAS.map((e) => (
              <Button
                key={e.href}
                variant="outline"
                size="lg"
                render={<Link href={e.href} />}
              >
                <e.icon />
                {e.label}
              </Button>
            ))}
          </div>
        </div>

        <p className="mt-16 text-xs text-muted-foreground">
          Prototype · Mock data · Phase 1 screens are fully designed; the Phase 2
          roadmap (AI suite, gamification, live events, mobile, and more) lives in
          the Admin console. Use the floating{" "}
          <span className="font-medium text-foreground">Prototype</span> button
          to jump around.
        </p>
      </div>
    </div>
  )
}

interface RoleCardProps {
  href: string
  icon: React.ReactNode
  title: string
  subtitle: string
  screens: string[]
}

function RoleCard({ href, icon, title, subtitle, screens }: RoleCardProps) {
  return (
    <Card className="group gap-0 p-6 transition-all hover:-translate-y-1 hover:ring-primary/30 hover:shadow-lg">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <ul className="mt-5 space-y-2">
        {screens.map((s) => (
          <li
            key={s}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <span className="size-1.5 rounded-full bg-primary/60" />
            {s}
          </li>
        ))}
      </ul>
      <Button className="mt-6 w-full" render={<Link href={href} />}>
        Open {title}
        <ArrowRight />
      </Button>
    </Card>
  )
}
