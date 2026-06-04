import { prisma } from '@/lib/prisma'

const chapterListSelect = {
  id: true,
  courseId: true,
  title: true,
  orderIndex: true,
  createdAt: true,
  updatedAt: true,
  lessons: {
    where: { deletedAt: null },
    orderBy: { orderIndex: 'asc' as const },
    select: {
      id: true,
      chapterId: true,
      title: true,
      type: true,
      status: true,
      orderIndex: true,
      durationSeconds: true,
    },
  },
} as const

async function listByCourse(courseId: string) {
  return prisma.chapter.findMany({
    where: { courseId, deletedAt: null },
    orderBy: { orderIndex: 'asc' },
    select: chapterListSelect,
  })
}

export const chapterService = {
  list: listByCourse,
}

export type ChapterListItem = Awaited<
  ReturnType<typeof listByCourse>
>[number]
export type LessonListItem = ChapterListItem['lessons'][number]
