'use server'

import { revalidatePath } from 'next/cache'

import { requireActiveUser } from '@/lib/auth/get-user'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
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
