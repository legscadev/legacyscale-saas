'use server'

import { revalidatePath } from 'next/cache'

import { requireAdmin } from '@/lib/auth/get-user'
import {
  employeeService,
  MemberEmailConflictError,
} from '@/lib/services/employee-service'
import { checklistTemplateService } from '@/lib/services/checklist-template-service'
import {
  addTemplateItemSchema,
  createEmployeeSchema,
  createTemplateSchema,
  moveTemplateItemSchema,
  offboardEmployeeSchema,
  updateChecklistItemSchema,
  updateEmployeeSchema,
  updateTemplateItemSchema,
  updateTemplateSchema,
  type AddTemplateItemInput,
  type CreateEmployeeInput,
  type CreateTemplateInput,
  type MoveTemplateItemInput,
  type OffboardEmployeeInput,
  type UpdateChecklistItemInput,
  type UpdateEmployeeInput,
  type UpdateTemplateInput,
  type UpdateTemplateItemInput,
} from '@/lib/validations/employee'

export async function createEmployeeAction(input: CreateEmployeeInput) {
  await requireAdmin()
  const parsed = createEmployeeSchema.parse(input)
  try {
    const employee = await employeeService.create(parsed)
    revalidatePath('/admin/onboarding')
    return employee
  } catch (err) {
    // Convert the low-level provisioning error into a friendlier
    // message the dialog can surface as a toast. Any other failure
    // propagates as-is so the caller still sees the root cause.
    if (err instanceof MemberEmailConflictError) {
      throw new Error('A user with this email already exists')
    }
    throw err
  }
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

// ---------------------------------------------------------------------
// Checklist template CRUD
// ---------------------------------------------------------------------

export async function getTemplateDetailAction(id: string) {
  await requireAdmin()
  return checklistTemplateService.get(id)
}

export async function createTemplateAction(input: CreateTemplateInput) {
  await requireAdmin()
  const parsed = createTemplateSchema.parse(input)
  const template = await checklistTemplateService.create(parsed)
  revalidatePath('/admin/onboarding')
  return template
}

export async function updateTemplateAction(
  id: string,
  input: UpdateTemplateInput,
) {
  await requireAdmin()
  const parsed = updateTemplateSchema.parse(input)
  const template = await checklistTemplateService.update(id, parsed)
  revalidatePath('/admin/onboarding')
  return template
}

export async function deleteTemplateAction(id: string) {
  await requireAdmin()
  await checklistTemplateService.delete(id)
  revalidatePath('/admin/onboarding')
}

export async function addTemplateItemAction(
  templateId: string,
  input: AddTemplateItemInput,
) {
  await requireAdmin()
  const parsed = addTemplateItemSchema.parse(input)
  const template = await checklistTemplateService.addItem(templateId, parsed)
  revalidatePath('/admin/onboarding')
  return template
}

export async function updateTemplateItemAction(
  itemId: string,
  input: UpdateTemplateItemInput,
) {
  await requireAdmin()
  const parsed = updateTemplateItemSchema.parse(input)
  const template = await checklistTemplateService.updateItem(itemId, parsed)
  revalidatePath('/admin/onboarding')
  return template
}

export async function moveTemplateItemAction(
  itemId: string,
  input: MoveTemplateItemInput,
) {
  await requireAdmin()
  const parsed = moveTemplateItemSchema.parse(input)
  const template = await checklistTemplateService.moveItem(itemId, parsed.targetIndex)
  revalidatePath('/admin/onboarding')
  return template
}

export async function getDeleteItemImpactAction(itemId: string) {
  await requireAdmin()
  return checklistTemplateService.deleteItemImpact(itemId)
}

export async function deleteTemplateItemAction(itemId: string) {
  await requireAdmin()
  const template = await checklistTemplateService.deleteItem(itemId)
  revalidatePath('/admin/onboarding')
  return template
}
