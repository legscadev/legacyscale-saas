import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { PageContainer } from "@/components/prototype/shared/page-container"
import { PageHeader } from "@/components/prototype/shared/page-header"
import { SectionCard } from "@/components/prototype/shared/section-card"
import { StatusBadge } from "@/components/prototype/shared/status-badge"
import { ProgressRing } from "@/components/prototype/shared/progress-ring"
import { AreaChart } from "@/components/prototype/charts/area-chart"
import { BarChart } from "@/components/prototype/charts/bar-chart"
import { DonutChart } from "@/components/prototype/charts/donut-chart"
import { Sparkline } from "@/components/prototype/charts/sparkline"
import { enrollmentTrend, enrollmentBySource } from "@/lib/prototype"

const BRAND_RAMP = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "950",
] as const

const RAMP_CLASS: Record<string, string> = {
  "50": "bg-brand-50",
  "100": "bg-brand-100",
  "200": "bg-brand-200",
  "300": "bg-brand-300",
  "400": "bg-brand-400",
  "500": "bg-brand-500",
  "600": "bg-brand-600",
  "700": "bg-brand-700",
  "800": "bg-brand-800",
  "900": "bg-brand-900",
  "950": "bg-brand-950",
}

const SEMANTIC = [
  { label: "success", className: "bg-success" },
  { label: "warning", className: "bg-warning" },
  { label: "error", className: "bg-error" },
  { label: "primary", className: "bg-primary" },
]

const SURFACES = [
  { label: "background", className: "bg-background" },
  { label: "card", className: "bg-card" },
  { label: "muted", className: "bg-muted" },
  { label: "border", className: "bg-border" },
]

const TYPE_SCALE = [
  { label: "text-4xl", className: "text-4xl font-bold tracking-tight" },
  { label: "text-2xl", className: "text-2xl font-semibold" },
  { label: "text-xl", className: "text-xl font-medium" },
  { label: "text-base", className: "text-base" },
  { label: "text-sm", className: "text-sm text-muted-foreground" },
  { label: "text-xs", className: "text-xs text-muted-foreground" },
]

const BUTTON_VARIANTS = [
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const

const STATUSES = [
  "ACTIVE",
  "PENDING",
  "EXPIRED",
  "REVOKED",
  "PUBLISHED",
  "DRAFT",
] as const

const SPACING = [2, 4, 6, 8, 12, 16, 24]

const SPACING_CLASS: Record<number, string> = {
  2: "w-0.5",
  4: "w-1",
  6: "w-1.5",
  8: "w-2",
  12: "w-3",
  16: "w-4",
  24: "w-6",
}

export default function DesignSystemPage() {
  return (
    <PageContainer size="wide" className="space-y-8">
      <Link
        href="/prototype"
        className="inline-flex items-center gap-1.5 text-sm font-medium
          text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to prototype
      </Link>

      <PageHeader
        title="Design System"
        description="Tokens, components, and patterns powering Kondense."
      />

      <BrandRampSection />
      <SemanticSection />
      <SurfacesSection />
      <TypographySection />
      <ButtonsSection />
      <BadgesSection />
      <FormControlsSection />
      <ChartsSection />
      <SpacingSection />
    </PageContainer>
  )
}

function BrandRampSection() {
  return (
    <SectionCard title="Brand ramp">
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-11">
        {BRAND_RAMP.map((shade) => (
          <div key={shade} className="space-y-1.5">
            <div
              className={`h-14 rounded-lg ring-1 ring-foreground/10 ${RAMP_CLASS[shade]}`}
            />
            <p className="text-center text-xs text-muted-foreground">
              {shade}
            </p>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function SemanticSection() {
  return (
    <SectionCard title="Semantic colors">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SEMANTIC.map((s) => (
          <div key={s.label} className="space-y-1.5">
            <div
              className={`h-14 rounded-lg ring-1 ring-foreground/10 ${s.className}`}
            />
            <p className="text-center text-xs text-muted-foreground">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function SurfacesSection() {
  return (
    <SectionCard title="Surfaces">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SURFACES.map((s) => (
          <div key={s.label} className="space-y-1.5">
            <div
              className={`h-14 rounded-lg border ${s.className}`}
            />
            <p className="text-center text-xs text-muted-foreground">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function TypographySection() {
  return (
    <SectionCard title="Typography scale">
      <div className="space-y-4">
        {TYPE_SCALE.map((t) => (
          <div
            key={t.label}
            className="flex items-baseline justify-between gap-4 border-b
              border-border/50 pb-3 last:border-0 last:pb-0"
          >
            <span className={t.className}>The quick brown fox</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t.label}
            </span>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function ButtonsSection() {
  return (
    <SectionCard title="Buttons">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </div>
      </div>
    </SectionCard>
  )
}

function BadgesSection() {
  return (
    <SectionCard title="Status badges">
      <div className="flex flex-wrap items-center gap-3">
        {STATUSES.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>
    </SectionCard>
  )
}

function FormControlsSection() {
  return (
    <SectionCard title="Form controls">
      <div className="grid gap-5 sm:max-w-md">
        <div className="space-y-2">
          <Label htmlFor="ds-input">Input</Label>
          <Input id="ds-input" placeholder="Type something…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ds-textarea">Textarea</Label>
          <Textarea id="ds-textarea" placeholder="A longer message…" />
        </div>
        <Label className="gap-2.5">
          <Checkbox defaultChecked />
          Email me about new modules
        </Label>
      </div>
    </SectionCard>
  )
}

function ChartsSection() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SectionCard title="Area chart">
        <AreaChart data={enrollmentTrend} />
      </SectionCard>
      <SectionCard title="Bar chart">
        <BarChart data={enrollmentBySource} />
      </SectionCard>
      <SectionCard title="Donut chart">
        <DonutChart data={enrollmentBySource} />
      </SectionCard>
      <SectionCard title="Progress ring & sparkline">
        <div className="flex items-center gap-8">
          <ProgressRing value={72} size={88} strokeWidth={8} />
          <div className="flex-1 text-primary">
            <Sparkline data={[3, 5, 4, 7, 6, 9, 8, 11]} height={48} />
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

function SpacingSection() {
  return (
    <SectionCard title="Spacing scale">
      <div className="space-y-3">
        {SPACING.map((px) => (
          <div key={px} className="flex items-center gap-4">
            <span className="w-12 text-xs tabular-nums text-muted-foreground">
              {px}px
            </span>
            <div
              className={`h-4 rounded bg-primary ${SPACING_CLASS[px]}`}
            />
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
