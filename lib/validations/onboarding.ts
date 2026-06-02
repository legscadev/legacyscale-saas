import { z } from 'zod'

import { passwordSchema } from './common'

/**
 * Wire format for POST /api/onboarding. The form payload alone (no
 * token) is reused on the client when building UI state — keep it
 * exported so client validation can ignore the token field.
 */
export const onboardingFormSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    path: ['confirm'],
    message: "Passwords don't match",
  })

export const completeOnboardingSchema = z.intersection(
  onboardingFormSchema,
  z.object({ token: z.string().min(1, 'Missing token') }),
)

export type OnboardingFormInput = z.infer<typeof onboardingFormSchema>
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>
