import { z } from 'zod'

export const questionTypeSchema = z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE'])

const questionTextSchema = z
  .string()
  .min(1, 'Question text is required')
  .max(1000, 'Question text is too long')

const optionTextSchema = z
  .string()
  .min(1, 'Option text is required')
  .max(300, 'Option text is too long')

const explanationSchema = z
  .string()
  .max(1000, 'Explanation is too long')
  .optional()
  .nullable()

// Multiple-choice: 2–6 options, correctIndex must point at one of them.
export const createMcQuestionSchema = z
  .object({
    type: z.literal('MULTIPLE_CHOICE'),
    questionText: questionTextSchema,
    options: z
      .array(optionTextSchema)
      .min(2, 'A multiple-choice question needs at least 2 options')
      .max(6, 'A multiple-choice question can have at most 6 options'),
    correctIndex: z.number().int().min(0),
    explanation: explanationSchema,
  })
  .refine((d) => d.correctIndex < d.options.length, {
    message: 'Pick which option is correct',
    path: ['correctIndex'],
  })

// True/false: fixed two options, correctIndex 0 or 1. Stored the same
// shape as MC so the renderer can treat both uniformly.
export const createTfQuestionSchema = z.object({
  type: z.literal('TRUE_FALSE'),
  questionText: questionTextSchema,
  options: z.tuple([z.literal('True'), z.literal('False')]),
  correctIndex: z.union([z.literal(0), z.literal(1)]),
  explanation: explanationSchema,
})

export const createQuestionSchema = z.discriminatedUnion('type', [
  createMcQuestionSchema,
  createTfQuestionSchema,
])

// Update re-uses the create schema — the form always submits a full
// payload (text + options + correctIndex + type), so there's no need
// for a partial variant. Avoids Zod 4's restriction that .partial()
// can't be called on schemas with .refine().
export const updateQuestionSchema = createQuestionSchema

export const reorderQuestionsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
})

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>
