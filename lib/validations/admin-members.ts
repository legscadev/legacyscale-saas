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

/**
 * Body shape for PATCH /api/admin/members/[id]. All fields are
 * optional so callers can update any subset (status toggle, edit
 * details, etc.) through the same endpoint. Email is intentionally
 * absent — that needs supabase.auth.admin.updateUserById and a
 * separate ticket.
 */
export const adminUpdateMemberSchema = z
  .object({
    name: nameSchema.optional(),
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
    /** true: soft-delete (sets deletedAt). false: restore from archive. */
    archive: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'Nothing to update' },
  )

export type AdminCreateMemberInput = z.infer<typeof adminCreateMemberSchema>
export type AdminUpdateMemberInput = z.infer<typeof adminUpdateMemberSchema>
