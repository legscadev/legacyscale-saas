import { z } from 'zod'
import {
  emailSchema,
  nameSchema,
  passwordSchema,
  idSchema,
  optionalUrlSchema,
} from './common'

export const userRoleSchema = z.enum(['ADMIN', 'TEAM', 'MEMBER'])
export type UserRole = z.infer<typeof userRoleSchema>

export const createUserSchema = z.object({
  email: emailSchema,
  name: nameSchema.optional(),
  password: passwordSchema,
})

export const updateUserSchema = z.object({
  name: nameSchema.optional(),
  avatarUrl: optionalUrlSchema,
})

export const updateUserRoleSchema = z.object({
  role: userRoleSchema,
})

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
})

// What the API returns for a user
export const userResponseSchema = z.object({
  id: idSchema,
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: userRoleSchema,
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type UserResponse = z.infer<typeof userResponseSchema>
