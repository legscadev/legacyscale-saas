import { type NextRequest } from 'next/server'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  MemberEmailConflictError,
  provisionMemberWithInvite,
} from '@/lib/services/member-provisioning'
import {
  errorResponse,
  serverErrorResponse,
  successResponse,
  validateBody,
} from '@/lib/api/helpers'
import { adminCreateMemberSchema } from '@/lib/validations/admin-members'

function emailConflictResponse() {
  return errorResponse('A member with this email already exists', 409, {
    email: ['A member with this email already exists'],
  })
}

export async function POST(request: NextRequest) {
  await requireAdmin()

  const validation = await validateBody(request, adminCreateMemberSchema)
  if (validation.error) return validation.error

  const { name, email, role, membershipId } = validation.data

  try {
    const member = await provisionMemberWithInvite({
      name,
      email,
      role,
      membershipId,
    })
    return successResponse({ member }, 201)
  } catch (err) {
    if (err instanceof MemberEmailConflictError) return emailConflictResponse()
    console.error('Provision member failed:', err)
    return serverErrorResponse()
  }
}
