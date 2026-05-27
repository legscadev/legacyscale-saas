import { BookOpen, GraduationCap, Megaphone, Users } from 'lucide-react'
import { PageHeader, StatCard } from '@/components/shared'
import { prisma } from '@/lib/prisma'

export default async function AdminDashboardPage() {
  const [members, courses, published, announcements] = await Promise.all([
    prisma.user.count({ where: { role: 'MEMBER', deletedAt: null } }),
    prisma.course.count({ where: { deletedAt: null } }),
    prisma.course.count({ where: { status: 'PUBLISHED', deletedAt: null } }),
    prisma.announcement.count({ where: { deletedAt: null } }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of your platform" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Members" value={members} icon={Users} />
        <StatCard title="Courses" value={courses} icon={GraduationCap} />
        <StatCard title="Published" value={published} icon={BookOpen} />
        <StatCard title="Announcements" value={announcements} icon={Megaphone} />
      </div>
    </div>
  )
}
