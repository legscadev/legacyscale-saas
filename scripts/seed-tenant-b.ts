// One-shot seed for the second tenant used by the cross-tenant E2E
// suite (tests/e2e/tenancy-cross-tenant.spec.ts).
//
// Creates:
//   - Company "Tenant B" (fixed uuid 00000000-0000-0000-0000-00000000000B)
//   - Owner user tenant-b@example.com with a random password (echoed
//     back on run so it can be pasted into .env.local as
//     E2E_TENANT_B_ADMIN_PASSWORD)
//   - CompanyMembership linking the owner to Tenant B as OWNER
//   - One published Course + one StatMetric + one CompanyMembership
//     for the E2E specs to reach for.
//
// Idempotent: re-running skips existing rows. Uses the Supabase
// service role client for auth user creation because Prisma alone
// can't create Supabase auth accounts.
//
// Usage: `pnpm tsx scripts/seed-tenant-b.ts`
//
// Prereqs in .env.local:
//   DATABASE_URL, DIRECT_URL, SUPABASE_SERVICE_ROLE_KEY,
//   NEXT_PUBLIC_SUPABASE_URL.

import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const TENANT_B_ID = '00000000-0000-0000-0000-00000000000b'
const OWNER_EMAIL = 'tenant-b@example.com'

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // 1. Company
  await prisma.company.upsert({
    where: { id: TENANT_B_ID },
    update: {},
    create: {
      id: TENANT_B_ID,
      slug: 'tenant-b',
      name: 'Tenant B',
      isAgency: false,
    },
  })
  console.log('Tenant B company:', TENANT_B_ID)

  // 2. Owner auth user + app-side row
  const password = randomBase64(24)
  const { data: existingAuth } = await supabase.auth.admin.listUsers()
  let ownerAuth = existingAuth?.users.find((u) => u.email === OWNER_EMAIL)
  if (!ownerAuth) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: OWNER_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { name: 'Tenant B Owner' },
    })
    if (error || !created.user) {
      throw new Error(`Failed to create auth user: ${error?.message}`)
    }
    ownerAuth = created.user
    console.log(`Created auth user ${OWNER_EMAIL} — password: ${password}`)
    console.log(`Set E2E_TENANT_B_ADMIN_EMAIL=${OWNER_EMAIL}`)
    console.log(`Set E2E_TENANT_B_ADMIN_PASSWORD=${password}`)
  } else {
    console.log(`Auth user ${OWNER_EMAIL} already exists — reusing`)
  }

  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: { authId: ownerAuth.id, isActive: true, role: 'ADMIN' },
    create: {
      email: OWNER_EMAIL,
      authId: ownerAuth.id,
      name: 'Tenant B Owner',
      role: 'ADMIN',
      isActive: true,
    },
  })

  // 3. Membership
  await prisma.companyMembership.upsert({
    where: {
      userId_companyId: { userId: owner.id, companyId: TENANT_B_ID },
    },
    update: { role: 'OWNER' },
    create: { userId: owner.id, companyId: TENANT_B_ID, role: 'OWNER' },
  })
  console.log('OWNER membership linked')

  // 4. Sample course
  const course = await prisma.course.upsert({
    where: { slug: 'tenant-b-course' },
    update: { companyId: TENANT_B_ID },
    create: {
      title: 'Tenant B Course',
      slug: 'tenant-b-course',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      audience: 'MEMBERS',
      orderIndex: 0,
      createdBy: owner.id,
      companyId: TENANT_B_ID,
    },
  })

  // 5. Sample stat metric — nested inside a division so the
  // /admin/stats/metrics/<id> route has something to look up.
  // No slug on stat rows (name is the identifier); look up by name.
  const existingDivision = await prisma.statDivision.findFirst({
    where: { name: 'Tenant B Division', companyId: TENANT_B_ID },
  })
  const division =
    existingDivision ??
    (await prisma.statDivision.create({
      data: {
        name: 'Tenant B Division',
        orderIndex: 0,
        companyId: TENANT_B_ID,
      },
    }))

  const existingMetric = await prisma.statMetric.findFirst({
    where: {
      name: 'Tenant B Metric',
      divisionId: division.id,
      companyId: TENANT_B_ID,
    },
  })
  const metric =
    existingMetric ??
    (await prisma.statMetric.create({
      data: {
        name: 'Tenant B Metric',
        unit: 'COUNT',
        divisionId: division.id,
        assignedToId: owner.id,
        companyId: TENANT_B_ID,
      },
    }))

  console.log(`Set E2E_TENANT_B_COMPANY_ID=${TENANT_B_ID}`)
  console.log(`Set E2E_TENANT_B_COURSE_SLUG=${course.slug}`)
  console.log(`Set E2E_TENANT_B_STAT_METRIC_ID=${metric.id}`)
  console.log(`Set E2E_TENANT_B_MEMBER_EMAIL=${OWNER_EMAIL}`)

  await prisma.$disconnect()
  await pool.end()
}

function randomBase64(bytes: number): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Buffer.from(buf).toString('base64')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
