'use server'

import { revalidatePath } from 'next/cache'

import { requireActiveUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export interface UpdateNotificationPrefsResult {
  ok: boolean
  error?: string
}

export async function updateNotificationPreferencesAction(input: {
  notifyAnnouncementEmail?: boolean
}): Promise<UpdateNotificationPrefsResult> {
  const user = await requireActiveUser()
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(input.notifyAnnouncementEmail !== undefined
          ? { notifyAnnouncementEmail: input.notifyAnnouncementEmail }
          : {}),
      },
    })
    revalidatePath('/profile')
    revalidatePath('/admin/profile')
    return { ok: true }
  } catch (err) {
    console.error('updateNotificationPreferences failed:', err)
    return { ok: false, error: 'Could not save preferences' }
  }
}
