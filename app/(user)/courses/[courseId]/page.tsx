import { PageHeader } from '@/components/shared'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface CourseDetailPageProps {
  params: Promise<{ courseId: string }>
}

export default async function CourseDetailPage({
  params,
}: CourseDetailPageProps) {
  const { courseId } = await params

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course"
        description="Curriculum and lessons will be loaded here"
      />

      <Card>
        <CardHeader>
          <CardTitle>Curriculum</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Chapters and lessons for course{' '}
            <span className="font-mono">{courseId}</span> will be rendered here
            once course data is wired up.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
