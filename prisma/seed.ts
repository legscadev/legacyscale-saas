import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local' })

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Starting seed...')

  // Create admin user (matches Supabase Auth user)
  const admin = await prisma.user.upsert({
    where: { email: 'ruel@legacyscale.co' },
    update: {},
    create: {
      email: 'ruel@legacyscale.co',
      name: 'Keanu Vasquez',
      role: 'ADMIN',
      isActive: true,
    },
  })
  console.log('✅ Admin user created:', admin.email)

  // Create sample course
  const course = await prisma.course.upsert({
    where: { id: 'sample-course-1' },
    update: {},
    create: {
      id: 'sample-course-1',
      title: '7-Figure Agency Program',
      description: 'The complete training curriculum for building a 7-figure marketing agency.',
      status: 'PUBLISHED',
      orderIndex: 0,
    },
  })
  console.log('✅ Sample course created:', course.title)

  // Create sample chapter
  const chapter = await prisma.chapter.upsert({
    where: { id: 'sample-chapter-1' },
    update: {},
    create: {
      id: 'sample-chapter-1',
      courseId: course.id,
      title: 'Getting Started',
      orderIndex: 0,
    },
  })
  console.log('✅ Sample chapter created:', chapter.title)

  // Create sample video lesson
  const videoLesson = await prisma.lesson.upsert({
    where: { id: 'sample-lesson-1' },
    update: {},
    create: {
      id: 'sample-lesson-1',
      chapterId: chapter.id,
      title: 'Welcome to the Program',
      type: 'VIDEO',
      status: 'READY',
      orderIndex: 0,
      description: 'Introduction to the 7-Figure Agency Program.',
      durationSeconds: 300, // 5 minutes
    },
  })
  console.log('✅ Sample video lesson created:', videoLesson.title)

  // Create sample quiz lesson
  const quizLesson = await prisma.lesson.upsert({
    where: { id: 'sample-lesson-2' },
    update: {},
    create: {
      id: 'sample-lesson-2',
      chapterId: chapter.id,
      title: 'Module 1 Quiz',
      type: 'QUIZ',
      status: 'READY',
      orderIndex: 1,
      description: 'Test your knowledge from Module 1.',
      passingScore: 70,
    },
  })
  console.log('✅ Sample quiz lesson created:', quizLesson.title)

  // Create sample quiz questions
  await prisma.quizQuestion.upsert({
    where: { id: 'sample-question-1' },
    update: {},
    create: {
      id: 'sample-question-1',
      lessonId: quizLesson.id,
      questionText: 'What is the primary focus of a 7-figure agency?',
      type: 'MULTIPLE_CHOICE',
      options: ['Low prices', 'High volume clients', 'High-ticket clients', 'All of the above'],
      correctIndex: 2,
      orderIndex: 0,
    },
  })

  await prisma.quizQuestion.upsert({
    where: { id: 'sample-question-2' },
    update: {},
    create: {
      id: 'sample-question-2',
      lessonId: quizLesson.id,
      questionText: 'Marketing fulfillment arbitrage is a valid business model.',
      type: 'TRUE_FALSE',
      options: ['True', 'False'],
      correctIndex: 0,
      orderIndex: 1,
    },
  })
  console.log('✅ Sample quiz questions created')

  // Create sample resource lesson
  const resourceLesson = await prisma.lesson.upsert({
    where: { id: 'sample-lesson-3' },
    update: {},
    create: {
      id: 'sample-lesson-3',
      chapterId: chapter.id,
      title: 'Agency Starter Kit',
      type: 'RESOURCE',
      status: 'READY',
      orderIndex: 2,
      description: 'Download the Agency Starter Kit PDF.',
      // Files live in the LessonResource table now; see the
      // resource upload flow in the admin builder rather than
      // seeding bucket objects here.
    },
  })
  console.log('✅ Sample resource lesson created:', resourceLesson.title)

  // Create sample announcement
  const announcement = await prisma.announcement.upsert({
    where: { id: 'sample-announcement-1' },
    update: {},
    create: {
      id: 'sample-announcement-1',
      title: 'Welcome to Legacy Scale!',
      body: 'We are excited to have you as part of our community. Start with the 7-Figure Agency Program to begin your journey.',
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  })
  console.log('✅ Sample announcement created:', announcement.title)

  console.log('🌱 Seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
