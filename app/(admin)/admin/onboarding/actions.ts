'use server'

import { revalidatePath } from 'next/cache'

import { requireTeamModuleAccess } from '@/lib/auth/get-user'
import {
  employeeService,
  MemberEmailConflictError,
} from '@/lib/services/employee-service'
import { checklistService } from '@/lib/services/checklist-service'
import {
  addChecklistItemSchema,
  createEmployeeSchema,
  moveChecklistItemSchema,
  offboardEmployeeSchema,
  updateChecklistItemFieldsSchema,
  updateChecklistItemSchema,
  updateEmployeeSchema,
  type AddChecklistItemInput,
  type CreateEmployeeInput,
  type MoveChecklistItemInput,
  type OffboardEmployeeInput,
  type UpdateChecklistItemFieldsInput,
  type UpdateChecklistItemInput,
  type UpdateEmployeeInput,
} from '@/lib/validations/employee'

export async function searchLinkableUsersAction(query: string) {
  await requireTeamModuleAccess('onboarding')
  return employeeService.searchLinkableUsers(query)
}

export async function createEmployeeAction(input: CreateEmployeeInput) {
  await requireTeamModuleAccess('onboarding')
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
  await requireTeamModuleAccess('onboarding')
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
  await requireTeamModuleAccess('onboarding')
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
  await requireTeamModuleAccess('onboarding')
  const employee = await employeeService.reactivate(id)
  revalidatePath('/admin/onboarding')
  revalidatePath(`/admin/onboarding/${id}`)
  return employee
}

export async function deleteEmployeeAction(id: string) {
  await requireTeamModuleAccess('onboarding')
  await employeeService.delete(id)
  revalidatePath('/admin/onboarding')
}

export async function updateChecklistItemStatusAction(
  employeeId: string,
  itemId: string,
  input: UpdateChecklistItemInput,
) {
  await requireTeamModuleAccess('onboarding')
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
// Global checklist item CRUD (single canonical list)
// ---------------------------------------------------------------------

export async function listChecklistItemsAction() {
  await requireTeamModuleAccess('onboarding')
  return checklistService.listItems()
}

export async function addChecklistItemAction(input: AddChecklistItemInput) {
  await requireTeamModuleAccess('onboarding')
  const parsed = addChecklistItemSchema.parse(input)
  const items = await checklistService.addItem(parsed)
  revalidatePath('/admin/onboarding')
  revalidatePath('/admin/onboarding/checklist')
  return items
}

export async function updateChecklistItemFieldsAction(
  itemId: string,
  input: UpdateChecklistItemFieldsInput,
) {
  await requireTeamModuleAccess('onboarding')
  const parsed = updateChecklistItemFieldsSchema.parse(input)
  const items = await checklistService.updateItem(itemId, parsed)
  revalidatePath('/admin/onboarding')
  revalidatePath('/admin/onboarding/checklist')
  return items
}

export async function moveChecklistItemAction(
  itemId: string,
  input: MoveChecklistItemInput,
) {
  await requireTeamModuleAccess('onboarding')
  const parsed = moveChecklistItemSchema.parse(input)
  const items = await checklistService.moveItem(itemId, parsed.targetIndex)
  revalidatePath('/admin/onboarding')
  revalidatePath('/admin/onboarding/checklist')
  return items
}

export async function getDeleteChecklistItemImpactAction(itemId: string) {
  await requireTeamModuleAccess('onboarding')
  return checklistService.deleteItemImpact(itemId)
}

export async function deleteChecklistItemAction(itemId: string) {
  await requireTeamModuleAccess('onboarding')
  const items = await checklistService.deleteItem(itemId)
  revalidatePath('/admin/onboarding')
  revalidatePath('/admin/onboarding/checklist')
  return items
}
