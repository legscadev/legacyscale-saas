'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import { employeeService } from '@/lib/services/employee-service'
import {
  createEmployeeSchema,
  offboardEmployeeSchema,
  updateChecklistItemSchema,
  updateEmployeeSchema,
  type CreateEmployeeInput,
  type OffboardEmployeeInput,
  type UpdateChecklistItemInput,
  type UpdateEmployeeInput,
} from '@/lib/validations/employee'

export async function createEmployeeAction(input: CreateEmployeeInput) {
  await requireAdmin()
  const parsed = createEmployeeSchema.parse(input)
  const employee = await employeeService.create(parsed)
  revalidatePath('/admin/onboarding')
  return employee
}

export async function updateEmployeeAction(
  id: string,
  input: UpdateEmployeeInput,
) {
  await requireAdmin()
  const parsed = updateEmployeeSchema.parse(input)
  const employee = await employeeService.update(id, parsed)
  revalidatePath('/admin/onboarding')
  revalidatePath(`/admin/onboarding/${id}`)
  return employee
}

export async function offboardEmployeeAction(
  id: string,
  input: OffboardEmployeeInput,
) {
  await requireAdmin()
  const parsed = offboardEmployeeSchema.parse(input)
  // The refine on `offboardingDate` guarantees non-null after parse.
  const employee = await employeeService.offboard(id, {
    offboardingDate: parsed.offboardingDate!,
    notes: parsed.notes ?? undefined,
  })
  revalidatePath('/admin/onboarding')
  revalidatePath(`/admin/onboarding/${id}`)
  return employee
}

export async function reactivateEmployeeAction(id: string) {
  await requireAdmin()
  const employee = await employeeService.reactivate(id)
  revalidatePath('/admin/onboarding')
  revalidatePath(`/admin/onboarding/${id}`)
  return employee
}

export async function deleteEmployeeAction(id: string) {
  await requireAdmin()
  await employeeService.delete(id)
  revalidatePath('/admin/onboarding')
}

export async function updateChecklistItemAction(
  employeeId: string,
  itemId: string,
  input: UpdateChecklistItemInput,
) {
  await requireAdmin()
  const parsed = updateChecklistItemSchema.parse(input)
  const employee = await employeeService.updateChecklistItem(employeeId, itemId, {
    status: parsed.status,
    note: parsed.note ?? undefined,
  })
  revalidatePath(`/admin/onboarding/${employeeId}`)
  revalidatePath('/admin/onboarding')
  return employee
}
