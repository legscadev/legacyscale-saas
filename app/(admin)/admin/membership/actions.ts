'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  membershipService,
  type MembershipListItem,
} from '@/lib/services/membership-service'
import {
  createMembershipSchema,
  updateMembershipSchema,
} from '@/lib/validations/membership'

export interface MembershipsData {
  items: MembershipListItem[]
}

export async function fetchMemberships(): Promise<MembershipsData> {
  await requireAdmin()
  const items = await membershipService.list()
  return { items }
}

export interface MembershipMutationResult {
  ok: boolean
  id?: string
  error?: string
  fieldErrors?: Record<string, string[]>
}

function fieldErrorsFromZod(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
  const out: Record<string, string[]> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.')
    if (!out[key]) out[key] = []
    out[key]!.push(issue.message)
  }
  return out
}

export async function createMembershipAction(
  formData: FormData,
): Promise<MembershipMutationResult> {
  await requireAdmin()

  const parsed = createMembershipSchema.safeParse({
    name: (formData.get('name') as string) ?? '',
    slug: (formData.get('slug') as string) || undefined,
    description: (formData.get('description') as string) || undefined,
  })

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    const row = await membershipService.create(parsed.data)
    revalidatePath('/admin/membership')
    return { ok: true, id: row.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not create membership'
    return { ok: false, error: message }
  }
}

export async function updateMembershipAction(
  id: string,
  formData: FormData,
): Promise<MembershipMutationResult> {
  await requireAdmin()

  const input: Record<string, unknown> = {}
  if (formData.has('name')) input.name = formData.get('name')
  if (formData.has('slug')) input.slug = formData.get('slug') || ''
  if (formData.has('description')) {
    const raw = formData.get('description') as string
    input.description = raw.length > 0 ? raw : null
  }

  const parsed = updateMembershipSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error.issues) }
  }

  try {
    await membershipService.update(id, parsed.data)
    revalidatePath('/admin/membership')
    revalidatePath('/admin/courses')
    return { ok: true, id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not update membership'
    return { ok: false, error: message }
  }
}

export async function deleteMembershipAction(
  id: string,
): Promise<MembershipMutationResult> {
  await requireAdmin()
  try {
    await membershipService.delete(id)
    revalidatePath('/admin/membership')
    revalidatePath('/admin/courses')
    return { ok: true }
  } catch (err) {
    console.error('Membership delete failed:', err)
    return { ok: false, error: 'Could not delete membership' }
  }
}
