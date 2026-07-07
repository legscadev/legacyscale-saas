import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PrismaClient, ChecklistItemStatus, EmploymentStatus } from '@prisma/client'

interface SeedItem {
  slug: string
  label: string
  orderIndex: number
}

interface SeedStatus {
  itemSlug: string
  status: 'OK' | 'PENDING' | 'ATTENTION' | 'NA'
}

interface SeedEmployee {
  name: string
  roleTitle: string
  status: 'ACTIVE' | 'OFFBOARDED'
  onboardingDate: string | null
  dateStarted: string | null
  offboardingDate: string | null
  statuses: SeedStatus[]
}

// The seed JSON still nests items under a `template` object (kept as-is
// so we don't have to migrate the checked-in fixture). We just ignore
// the wrapping metadata now that the template abstraction is gone.
interface SeedData {
  template: {
    slug: string
    name: string
    description: string | null
    isDefault: boolean
    items: SeedItem[]
  }
  employees: SeedEmployee[]
}

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadSeedData(): SeedData {
  const raw = readFileSync(
    resolve(__dirname, 'seed-data', 'onboarding.json'),
    'utf-8',
  )
  return JSON.parse(raw) as SeedData
}

function toDate(iso: string | null): Date | null {
  return iso ? new Date(`${iso}T00:00:00Z`) : null
}

export async function seedOnboarding(prisma: PrismaClient): Promise<void> {
  const data = loadSeedData()

  // Upsert items keyed by orderIndex — that's the natural key now
  // that everything lives in one flat table.
  const itemBySlug = new Map<string, string>()
  for (const item of data.template.items) {
    const row = await prisma.onboardingChecklistItem.upsert({
      where: { orderIndex: item.orderIndex },
      update: { label: item.label },
      create: {
        label: item.label,
        orderIndex: item.orderIndex,
      },
    })
    itemBySlug.set(item.slug, row.id)
  }

  for (const emp of data.employees) {
    // Employees are keyed by (name + onboardingDate). It's a soft
    // key because there's no natural unique — but for seed
    // idempotency it's good enough: two different hires never
    // share both.
    const existing = await prisma.employee.findFirst({
      where: {
        name: emp.name,
        onboardingDate: toDate(emp.onboardingDate),
      },
    })

    const payload = {
      name: emp.name,
      roleTitle: emp.roleTitle,
      status: emp.status as EmploymentStatus,
      onboardingDate: toDate(emp.onboardingDate),
      dateStarted: toDate(emp.dateStarted),
      offboardingDate: toDate(emp.offboardingDate),
    }

    const employee = existing
      ? await prisma.employee.update({ where: { id: existing.id }, data: payload })
      : await prisma.employee.create({ data: payload })

    for (const s of emp.statuses) {
      const itemId = itemBySlug.get(s.itemSlug)
      if (!itemId) continue
      await prisma.employeeChecklistItemStatus.upsert({
        where: {
          employeeId_itemId: { employeeId: employee.id, itemId },
        },
        update: { status: s.status as ChecklistItemStatus },
        create: {
          employeeId: employee.id,
          itemId,
          status: s.status as ChecklistItemStatus,
        },
      })
    }
  }

  console.warn(
    `✅ Seeded onboarding: ${data.template.items.length} items, ${data.employees.length} employees`,
  )
}
