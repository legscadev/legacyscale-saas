// Production seed — one-off bootstrap for the platform's first tenant
// and super-admin. Safe to re-run: every write is an upsert or a
// find-first-then-create; nothing deletes.
//
// Requires DATABASE_URL + DIRECT_URL set in the environment. Reads
// operator identity from FIRST_SUPER_ADMIN_EMAIL (default
// ruel@legacyscale.co) and FIRST_SUPER_ADMIN_NAME (default
// "Ruel Cabaluna Jr").
//
// The Supabase Auth side (auth.users) is NOT touched here — this
// script only seeds public.users, super_admin_grants, companies, and
// company_memberships. To actually sign in, create the matching
// auth.users row in the Supabase Dashboard (Auth → Users → Add user
// with the same email). First login will link authId via
// syncUserToDatabase automatically.
//
// Run:
//   DATABASE_URL=... DIRECT_URL=... pnpm exec tsx scripts/seed-prod.ts

import { prisma } from '@/lib/prisma'
import { PLATFORM_SEED_COMPANY_ID } from '@/lib/tenancy/seed'

const KONDENSE_ID = PLATFORM_SEED_COMPANY_ID
const KONDENSE_SLUG = 'legacy-scale'
const KONDENSE_NAME = 'Legacy Scale'

const OPERATOR_EMAIL = (
  process.env.FIRST_SUPER_ADMIN_EMAIL ?? 'ruel@legacyscale.co'
)
  .toLowerCase()
  .trim()
const OPERATOR_NAME =
  process.env.FIRST_SUPER_ADMIN_NAME ?? 'Ruel Cabaluna Jr'

async function main() {
  console.log(`\n🌱  Seeding prod DB — target super-admin: ${OPERATOR_EMAIL}`)

  // 1. Kondense platform tenant. The zero-UUID id is load-bearing —
  //    every `companyId` column across the schema defaults to it, so
  //    the row MUST exist before any non-tenant-scoped inserts fire.
  const kondense = await prisma.company.upsert({
    where: { id: KONDENSE_ID },
    update: {},
    create: {
      id: KONDENSE_ID,
      slug: KONDENSE_SLUG,
      name: KONDENSE_NAME,
      isAgency: true,
    },
    select: { id: true, name: true, slug: true, createdAt: true },
  })
  console.log(`   ✓ Company: ${kondense.name} (${kondense.slug})`)

  // 2. Operator's User row. Left with authId=null on first seed;
  //    first login through Supabase Auth will fill it in via
  //    syncUserToDatabase (see lib/auth/sync-user.ts).
  const operator = await prisma.user.upsert({
    where: { email: OPERATOR_EMAIL },
    update: {
      // Never demote an existing operator; only lift them up.
      role: 'ADMIN',
      isSuperAdmin: true,
      isActive: true,
    },
    create: {
      email: OPERATOR_EMAIL,
      name: OPERATOR_NAME,
      role: 'ADMIN',
      isSuperAdmin: true,
      isActive: true,
      emailVerified: false,
    },
    select: {
      id: true,
      email: true,
      role: true,
      isSuperAdmin: true,
      authId: true,
    },
  })
  console.log(
    `   ✓ User:    ${operator.email} · role=${operator.role} · isSuperAdmin=${operator.isSuperAdmin}${operator.authId ? '' : ' (authId not linked yet)'}`,
  )

  // 3. SuperAdminGrant — audit trail entry for the master key. Only
  //    seeded when there's no live grant (revokedAt IS NULL) so
  //    re-runs don't stack duplicate rows.
  const existingGrant = await prisma.superAdminGrant.findFirst({
    where: { userId: operator.id, revokedAt: null },
    select: { id: true },
  })
  if (existingGrant) {
    console.log(`   ✓ SuperAdminGrant already active (${existingGrant.id})`)
  } else {
    const grant = await prisma.superAdminGrant.create({
      data: {
        userId: operator.id,
        // grantedById: null — no grantor at seed time
        notes: 'Platform bootstrap — seeded via scripts/seed-prod.ts',
      },
      select: { id: true },
    })
    console.log(`   ✓ SuperAdminGrant issued (${grant.id})`)
  }

  // 4. OWNER membership on Kondense so the tenant isn't orphaned +
  //    the operator shows up as OWNER on /super/companies. Upsert so
  //    re-runs don't create duplicate rows.
  const membership = await prisma.companyMembership.upsert({
    where: {
      userId_companyId: { userId: operator.id, companyId: kondense.id },
    },
    update: { role: 'OWNER' },
    create: {
      userId: operator.id,
      companyId: kondense.id,
      role: 'OWNER',
    },
    select: { id: true, role: true },
  })
  console.log(
    `   ✓ CompanyMembership: ${operator.email} → ${kondense.name} · role=${membership.role}`,
  )

  console.log(`\n✅ Prod seed complete.\n`)
  console.log(`Next step:`)
  console.log(`  1. In the prod Supabase Dashboard → Auth → Users, add an`)
  console.log(`     account for ${OPERATOR_EMAIL} with a strong password.`)
  console.log(`  2. Sign in at your prod URL — first login links authId.`)
  console.log(`  3. Confirm you can reach /super/dashboard.\n`)

  await prisma.$disconnect()
}

main().catch(async (err) => {
  console.error('❌ Seed failed:', err)
  await prisma.$disconnect()
  process.exit(1)
})
