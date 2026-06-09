import { Prisma, type QuestionType } from '@prisma/client'

import { prisma } from '@/lib/prisma'

const questionListSelect = {
  id: true,
  lessonId: true,
  questionText: true,
  type: true,
  options: true,
  correctIndex: true,
  explanation: true,
  orderIndex: true,
  createdAt: true,
  updatedAt: true,
} as const

async function listByLesson(lessonId: string) {
  return prisma.quizQuestion.findMany({
    where: { lessonId },
    orderBy: { orderIndex: 'asc' },
    select: questionListSelect,
  })
}

interface CreateQuestionInput {
  lessonId: string
  questionText: string
  type: QuestionType
  options: string[]
  correctIndex: number
  explanation?: string | null
}

async function createQuestion(input: CreateQuestionInput) {
  // Slot the new question at the end of the existing list.
  const last = await prisma.quizQuestion.findFirst({
    where: { lessonId: input.lessonId },
    orderBy: { orderIndex: 'desc' },
    select: { orderIndex: true },
  })
  const orderIndex = (last?.orderIndex ?? -1) + 1

  return prisma.quizQuestion.create({
    data: {
      lessonId: input.lessonId,
      questionText: input.questionText,
      type: input.type,
      // Prisma's JSON column wants InputJsonValue; cast through unknown so
      // the string[] passes without losing type info downstream.
      options: input.options as unknown as Prisma.InputJsonValue,
      correctIndex: input.correctIndex,
      explanation: input.explanation ?? null,
      orderIndex,
    },
    select: questionListSelect,
  })
}

interface UpdateQuestionInput {
  questionText?: string
  type?: QuestionType
  options?: string[]
  correctIndex?: number
  explanation?: string | null
}

async function updateQuestion(id: string, input: UpdateQuestionInput) {
  const data: Prisma.QuizQuestionUpdateInput = {}
  if (input.questionText !== undefined) data.questionText = input.questionText
  if (input.type !== undefined) data.type = input.type
  if (input.options !== undefined) {
    data.options = input.options as unknown as Prisma.InputJsonValue
  }
  if (input.correctIndex !== undefined) data.correctIndex = input.correctIndex
  if (input.explanation !== undefined) data.explanation = input.explanation

  return prisma.quizQuestion.update({
    where: { id },
    data,
    select: questionListSelect,
  })
}

async function deleteQuestion(id: string) {
  return prisma.quizQuestion.delete({
    where: { id },
    select: { id: true, lessonId: true },
  })
}

/**
 * Bulk reorder. Caller passes question ids in the order they should
 * appear; we rewrite orderIndex to match the array position. Bound to a
 * single lesson to keep the surface tight.
 */
async function reorderQuestions(lessonId: string, orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.quizQuestion.update({
        where: { id, lessonId },
        data: { orderIndex: index },
      }),
    ),
  )
}

export const quizService = {
  list: listByLesson,
  create: createQuestion,
  update: updateQuestion,
  delete: deleteQuestion,
  reorder: reorderQuestions,
}

export type QuizQuestionItem = Awaited<
  ReturnType<typeof listByLesson>
>[number]
