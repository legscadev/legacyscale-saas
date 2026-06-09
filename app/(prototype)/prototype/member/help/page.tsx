import Link from "next/link"
import {
  BookOpen,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageContainer } from "@/components/prototype/shared/page-container"
import { PageHeader } from "@/components/prototype/shared/page-header"

const CATEGORIES: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Sparkles, title: "Getting started", desc: "Set up your account and find your way around." },
  { icon: BookOpen, title: "Courses & lessons", desc: "Playback, progress, quizzes, and resources." },
  { icon: ShieldCheck, title: "Account & access", desc: "Profile, password, and login help." },
]

const FAQS = [
  {
    q: "How do I resume a lesson where I left off?",
    a: "Your dashboard always shows a “Continue learning” card that jumps you straight back to your last position.",
  },
  {
    q: "Why can't I see a course I purchased?",
    a: "Access is granted automatically after purchase. If it's missing, contact support and we'll resolve it quickly.",
  },
  {
    q: "How many times can I retake a quiz?",
    a: "Most quizzes allow up to 3 attempts. You'll see the limit and your passing score before you start.",
  },
  {
    q: "Does my access expire?",
    a: "Most programs include lifetime access. Any time-limited access is shown on your Account → Access page.",
  },
]

export default function MemberHelp() {
  return (
    <PageContainer>
      <PageHeader
        title="Help & Support"
        description="Find answers fast, or reach out to our team."
      />

      <div className="relative mt-6 max-w-xl">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search help articles…"
          className="h-10 pl-9"
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <Card key={c.title} className="flex-row items-start gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <c.icon className="size-4" />
            </span>
            <div>
              <p className="font-medium">{c.title}</p>
              <p className="text-sm text-muted-foreground">{c.desc}</p>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold">Frequently asked</h2>
      <div className="mt-3 divide-y rounded-xl border">
        {FAQS.map((f) => (
          <details key={f.q} className="group px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
              {f.q}
              <span className="text-muted-foreground transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>

      <Card className="mt-10 flex-row flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="font-medium">Still need help?</p>
          <p className="text-sm text-muted-foreground">
            Our team typically replies within a few hours. In-app tickets are
            coming in Phase 2.
          </p>
        </div>
        <Button render={<Link href="mailto:support@kondense.ai" />}>
          <Mail />
          Contact support
        </Button>
      </Card>
    </PageContainer>
  )
}
