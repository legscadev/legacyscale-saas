import { z } from 'zod'

import { passwordSchema } from './common'

export const completeOnboardingSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    path: ['confirm'],
    message: "Passwords don't match",
  })

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>
