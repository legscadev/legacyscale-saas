import { type NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

import { requireAdmin } from '@/lib/auth/get-user'
import { syncRoleToAuthMetadata } from '@/lib/auth/sync-user'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  successResponse,
  validateBody,
} from '@/lib/api/helpers'
import { adminUpdateMemberSchema } from '@/lib/validations/admin-members'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  const { id } = await context.params

  const validation = await validateBody(request, adminUpdateMemberSchema)
  if (validation.error) return validation.error

  const { name, role, isActive, password, archive, categoryId } =
    validation.data

  // Self-modification guards. Admins can update their own name freely,
  // but they can't change their own role (could lock themselves out of
  // admin), deactivate themselves, or archive themselves. Password
  // change on self is fine — same as using the profile flow.
  if (id === admin.id) {
    if (role !== undefined && role !== admin.role) {
      return errorResponse("You can't change your own role", 400)
    }
    if (isActive !== undefined) {
      return errorResponse("You can't change your own access status", 400)
    }
    if (archive !== undefined) {
      return errorResponse("You can't archive yourself", 400)
    }
  }

  // Archiving is mutually exclusive with the other fields in this
  // request — admins shouldn't pile changes onto a delete. We allow
  // restoring (archive: false) on its own too.
  // Allow editing while restoring? Skip for simplicity — restore-only.
  try {
    const user = await prisma.user.update({
      where: { id, deletedAt: archive === false ? { not: null } : null },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(archive === true ? { deletedAt: new Date() } : {}),
        ...(archive === false ? { deletedAt: null } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
      },
      select: {
        id: true,
        authId: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        deletedAt: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
      },
    })

    // Mirror role to Supabase Auth app_metadata so the Edge proxy's
    // role-aware redirect stays in sync. Best-effort — RBAC is enforced
    // by Prisma via requireAdmin(), this is a UX hint for the proxy.
    if (role !== undefined && user.authId) {
      try {
        await syncRoleToAuthMetadata(user.authId, user.role)
      } catch (err) {
        console.error('Role mirror after update failed:', err)
      }
    }

    // If the email belongs to Supabase Auth user_metadata.name too,
    // mirror the rename so the welcome email + sidebar use the new
    // name on the next login. Best-effort.
    if (name !== undefined && user.authId) {
      try {
        const supabase = createAdminClient()
        await supabase.auth.admin.updateUserById(user.authId, {
          user_metadata: { name },
        })
      } catch (err) {
        console.error('Name mirror to auth metadata failed:', err)
      }
    }

    // Admin-driven password reset. Goes straight through the auth
    // admin API — bypasses the user's own reset-email flow. We only
    // attempt this when the member has an authId (anyone seeded via
    // our normal flow always does).
    if (password !== undefined && user.authId) {
      try {
        const supabase = createAdminClient()
        const { error: pwErr } =
          await supabase.auth.admin.updateUserById(user.authId, { password })
        if (pwErr) {
          console.error('Member password reset failed:', pwErr.message)
          return errorResponse(
            `Member fields updated, but password change failed: ${pwErr.message}`,
            500,
          )
        }
      } catch (err) {
        console.error('Member password reset threw:', err)
        return errorResponse(
          'Member fields updated, but password change threw an error.',
          500,
        )
      }
    }

    return successResponse({
      member: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        archived: user.deletedAt !== null,
        categoryId: user.categoryId,
        category: user.category,
      },
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return notFoundResponse('Member')
    }
    console.error('Member update failed:', err)
    return serverErrorResponse()
  }
}
