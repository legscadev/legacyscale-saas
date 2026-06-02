import { z } from 'zod'

import { emailSchema, nameSchema } from './common'
import { userRoleSchema } from './user'

/**
 * Schema for the admin "create member" form. Password is server-
 * generated (not user input), so it's not part of the request body.
 */
export const adminCreateMemberSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  role: userRoleSchema.default('MEMBER'),
})

export type AdminCreateMemberInput = z.infer<typeof adminCreateMemberSchema>
