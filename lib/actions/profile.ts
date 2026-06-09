'use server'

import { revalidatePath } from 'next/cache'

import { requireActiveUser } from '@/lib/auth/get-user'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { changePasswordSchema } from '@/lib/validations/auth'
import { nameSchema } from '@/lib/validations/common'

export type UpdateProfileResult =
  | { success: true; name: string }
  | { success: false; error: string }

export async function updateProfileName(
  formData: FormData,
): Promise<UpdateProfileResult> {
  const user = await requireActiveUser()
  const raw = String(formData.get('name') ?? '')

  const parsed = nameSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid name',
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data },
  })

  // Mirror to Supabase Auth user_metadata so it stays consistent with
  // the welcome email + any other place that reads from auth.users.
  if (user.authId) {
    try {
      const supabase = createAdminClient()
      await supabase.auth.admin.updateUserById(user.authId, {
        user_metadata: { name: parsed.data },
      })
    } catch (err) {
      // Non-fatal — the DB is the source of truth.
      console.error('Profile name mirror to auth metadata failed:', err)
    }
  }

  // The sidebar (in (user)/layout.tsx) reads the user's name from a
  // server component, so we need to revalidate to refresh it.
  revalidatePath('/profile')
  revalidatePath('/', 'layout')

  return { success: true, name: parsed.data }
}

export type UpdateAvatarResult =
  | { success: true; avatarUrl: string }
  | { success: false; error: string }

/**
 * Persist a new avatar URL. The actual upload happens client-side
 * directly to Supabase Storage (RLS enforces path = auth.uid()), so
 * this server action only confirms the URL points at our bucket
 * before writing it to the DB.
 */
export async function updateAvatarUrl(
  rawUrl: string,
): Promise<UpdateAvatarResult> {
  const user = await requireActiveUser()

  const expectedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`
  if (!rawUrl.startsWith(expectedPrefix)) {
    return { success: false, error: 'Invalid avatar URL' }
  }

  // The Storage path is everything after the bucket prefix. RLS made
  // sure the client could only upload under their own auth uid, but we
  // double-check here so a stolen client session can't switch the URL
  // to point at someone else's folder.
  const objectPath = rawUrl.slice(expectedPrefix.length)
  const firstFolder = objectPath.split('/')[0]
  if (!user.authId || firstFolder !== user.authId) {
    return {
      success: false,
      error: "Avatar must be in your own folder",
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: rawUrl },
  })

  revalidatePath('/profile')
  revalidatePath('/', 'layout')

  return { success: true, avatarUrl: rawUrl }
}

export type ChangePasswordResult =
  | { success: true }
  | {
      success: false
      error?: string
      fieldErrors?: Partial<
        Record<'currentPassword' | 'newPassword' | 'confirmPassword', string[]>
      >
    }

/**
 * Re-authenticates via signInWithPassword (so we don't trust the
 * existing session for a high-security change), then updates the
 * password through the same cookie-aware client.
 */
export async function updatePassword(
  formData: FormData,
): Promise<ChangePasswordResult> {
  const user = await requireActiveUser()

  const raw = {
    currentPassword: String(formData.get('currentPassword') ?? ''),
    newPassword: String(formData.get('newPassword') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  }

  const parsed = changePasswordSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: NonNullable<
      Extract<ChangePasswordResult, { success: false }>['fieldErrors']
    > = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (
        key === 'currentPassword' ||
        key === 'newPassword' ||
        key === 'confirmPassword'
      ) {
        if (!fieldErrors[key]) fieldErrors[key] = []
        fieldErrors[key]!.push(issue.message)
      }
    }
    return { success: false, fieldErrors }
  }

  const supabase = await createClient()

  // 1. Verify the current password by re-authenticating. signInWithPassword
  //    returns 400 with "Invalid login credentials" when the password
  //    doesn't match — surface that as a field-level error.
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  })
  if (signInErr) {
    return {
      success: false,
      fieldErrors: {
        currentPassword: ['Current password is incorrect'],
      },
    }
  }

  // 2. Set the new password. Supabase rejects setting the same value as
  //    the existing one with a specific message — pass that through to
  //    the new-password field.
  const { error: updateErr } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  })
  if (updateErr) {
    if (/same|different/i.test(updateErr.message)) {
      return {
        success: false,
        fieldErrors: {
          newPassword: [
            'New password must be different from your current password',
          ],
        },
      }
    }
    console.error('updateUser failed:', updateErr.message)
    return { success: false, error: 'Could not update password — try again' }
  }

  return { success: true }
}
