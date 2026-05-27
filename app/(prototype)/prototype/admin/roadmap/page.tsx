import {
  BarChart3,
  Bot,
  CalendarDays,
  FileSignature,
  GraduationCap,
  Mail,
  RefreshCw,
  Rocket,
  Search,
  Smartphone,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { PageContainer } from "@/components/prototype/shared/page-container"
import { PageHeader } from "@/components/prototype/shared/page-header"
import { SectionCard } from "@/components/prototype/shared/section-card"

interface RoadmapItem {
  name: string
  icon: LucideIcon
  purpose: string
}

interface RoadmapGroup {
  title: string
  description: string
  items: RoadmapItem[]
}

const GROUPS: RoadmapGroup[] = [
  {
    title: "AI Suite",
    description: "Intelligence layered on top of a proven content base.",
    items: [
      {
        name: "AI Marketing Copy Generator",
        icon: Sparkles,
        purpose:
          "Generate on-brand ads, emails, and landing-page copy for members' agencies on demand.",
      },
      {
        name: "AI Proposal Builder",
        icon: FileSignature,
        purpose:
          "Turn a few inputs into a polished, client-ready agency proposal in minutes.",
      },
      {
        name: "AI Coaching Agent",
        icon: Bot,
        purpose:
          "An always-on AI mentor that answers member questions from the program's content.",
      },
    ],
  },
  {
    title: "Engagement & Recognition",
    description: "Reinforce retention once organic habits are proven.",
    items: [
      {
        name: "Gamification (Points / Badges)",
        icon: Trophy,
        purpose:
          "Reward progress with points and badges to lift motivation and course completion.",
      },
      {
        name: "Certificates",
        icon: GraduationCap,
        purpose:
          "Issue shareable completion certificates members can show clients and on LinkedIn.",
      },
    ],
  },
  {
    title: "Live & Scheduling",
    description: "Move beyond manual links when live becomes a core driver.",
    items: [
      {
        name: "Live Event Calendar",
        icon: CalendarDays,
        purpose:
          "A built-in schedule of live calls and workshops members can browse and join.",
      },
      {
        name: "Google Calendar OAuth",
        icon: RefreshCw,
        purpose:
          "Auto-sync live events to members' Google Calendars with reminders.",
      },
    ],
  },
  {
    title: "Platform & Growth",
    description: "Scale-driven capabilities, triggered by real usage data.",
    items: [
      {
        name: "Admin BI Analytics Dashboard",
        icon: BarChart3,
        purpose:
          "Deep reporting on engagement, revenue, and cohort trends for business decisions.",
      },
      {
        name: "Email Notification Preferences",
        icon: Mail,
        purpose:
          "Let members choose which emails they get — digests, reminders, and announcements.",
      },
      {
        name: "Course Search",
        icon: Search,
        purpose: "Fast search across courses and lessons as the library grows.",
      },
      {
        name: "Mobile App (iOS / Android)",
        icon: Smartphone,
        purpose:
          "Native mobile learning with offline access and push notifications.",
      },
    ],
  },
]

export default function AdminRoadmap() {
  const total = GROUPS.reduce((n, g) => n + g.items.length, 0)

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Phase 2 Roadmap"
        description="Sequenced by impact and readiness — none of these block launch."
      />

      <Card className="mt-6 flex-row items-start gap-4 p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Rocket className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {total} features intentionally deferred past the MVP
          </p>
          <p className="text-sm text-muted-foreground">
            The MVP wins on content and a rock-solid learning experience first.
            Each feature below layers on once it&apos;s needed — keeping the initial
            build lean, cheap to run, and fast to validate.
          </p>
        </div>
      </Card>

      <div className="mt-6 space-y-6">
        {GROUPS.map((group) => (
          <SectionCard
            key={group.title}
            title={group.title}
            description={group.description}
            flush
          >
            <ul className="divide-y">
              {group.items.map((item) => (
                <RoadmapRow key={item.name} item={item} />
              ))}
            </ul>
          </SectionCard>
        ))}
      </div>
    </PageContainer>
  )
}

function RoadmapRow({ item }: { item: RoadmapItem }) {
  const Icon = item.icon
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <p className="min-w-0 font-medium">{item.name}</p>
      </div>
      <div className="shrink-0 rounded-lg bg-muted/50 px-3 py-2 sm:w-72">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Purpose
        </p>
        <p className="text-sm">{item.purpose}</p>
      </div>
    </li>
  )
}
