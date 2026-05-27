import { PageHeader } from '@/components/shared'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of your platform" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Member stats will be displayed here. Rich metric cards arrive
              with the design system (0.10).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Course Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Course completion stats will be displayed here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
