import { PageHeader } from '@/components/shared'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function UserDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Track your learning progress" />

      <Card>
        <CardHeader>
          <CardTitle>Continue Learning</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your enrolled courses will appear here. Progress cards arrive with
            the design system (0.10).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Announcements</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No new announcements.</p>
        </CardContent>
      </Card>
    </div>
  )
}
