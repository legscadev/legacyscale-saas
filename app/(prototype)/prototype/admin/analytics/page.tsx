import { Calendar, Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageContainer } from "@/components/prototype/shared/page-container"
import { PageHeader } from "@/components/prototype/shared/page-header"
import { SectionCard } from "@/components/prototype/shared/section-card"
import { StatCard } from "@/components/prototype/shared/stat-card"
import { AreaChart } from "@/components/prototype/charts/area-chart"
import { BarChart } from "@/components/prototype/charts/bar-chart"
import { DonutChart } from "@/components/prototype/charts/donut-chart"
import {
  adminKpis,
  completionFunnel,
  enrollmentBySource,
  enrollmentTrend,
  topCoursesByEngagement,
} from "@/lib/prototype"

export default function AdminAnalytics() {
  return (
    <PageContainer size="wide">
      <PageHeader
        title="Analytics"
        description="Engagement, completion, and acquisition across the platform."
        actions={
          <>
            <Button variant="outline">
              <Calendar />
              Last 8 months
            </Button>
            <Button variant="outline">
              <Download />
              Export
            </Button>
          </>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {adminKpis.map((stat, i) => (
          <StatCard key={stat.label} stat={stat} index={i} />
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Enrollment trend"
          description="New enrollments per month"
          className="lg:col-span-2"
        >
          <AreaChart data={enrollmentTrend} />
        </SectionCard>
        <SectionCard
          title="Acquisition source"
          description="Where members come from"
        >
          <DonutChart data={enrollmentBySource} size={150} />
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Completion funnel"
          description="From enrolled to completed"
        >
          <BarChart data={completionFunnel} />
        </SectionCard>
        <SectionCard
          title="Top courses by engagement"
          description="Active enrollments per course"
        >
          <BarChart data={topCoursesByEngagement} />
        </SectionCard>
      </div>
    </PageContainer>
  )
}
