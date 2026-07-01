'use server'

import { revalidatePath } from 'next/cache'

import { requireActiveUser } from '@/lib/auth'
import { dismissNudge } from '@/lib/services/nudge-service'

export async function dismissNudgeAction(
  nudgeId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireActiveUser()
  const result = await dismissNudge(user.id, nudgeId)
  if (result.ok) revalidatePath('/', 'layout')
  return result
}
