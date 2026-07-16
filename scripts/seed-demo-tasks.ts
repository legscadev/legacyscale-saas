// Seed demo tasks across the Kondense team. Idempotent-ish — any
// prior seed tasks (prefixed "[SEED]") are wiped first, then a
// fresh set is inserted. Assignments spread across the 7 team
// members; statuses / priorities / due dates are chosen for a
// realistic spread that exercises every column and filter.
//
// Run:  pnpm tsx scripts/seed-demo-tasks.ts

import { config } from 'dotenv'
config({ path: '.env.local' })

const KONDENSE_ID = '00000000-0000-0000-0000-000000000001'

/** Bias hints for which user tends to take which kind of work.
 *  Keeps assignments feeling human-picked without being locked. */
type Domain =
  | 'development'
  | 'video'
  | 'graphic'
  | 'wordpress'
  | 'ghl'
  | 'payments'
  | 'ar'
  | 'revamp'
  | 'meeting'
  | 'call'
  | 'ops'

interface TaskDraft {
  title: string
  domain: Domain
  /** Optional per-task priority nudge. Others fall back to a
   *  weighted mix. */
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
}

const DRAFTS: TaskDraft[] = [
  // Development
  { title: 'Fix quiz progress not persisting on refresh', domain: 'development', priority: 'HIGH' },
  { title: 'Migrate legacy webhook handler to typed schema', domain: 'development' },
  { title: 'Add rate limiting to public /api/leads endpoint', domain: 'development' },
  { title: 'Investigate Prisma cold-start latency in prod', domain: 'development', priority: 'HIGH' },
  { title: 'Refactor member onboarding flow to async queue', domain: 'development' },
  { title: 'Ship dark mode support for lesson player', domain: 'development', priority: 'LOW' },
  { title: 'Add super-admin impersonation banner', domain: 'development' },
  { title: 'Instrument Sentry on lesson upload errors', domain: 'development' },

  // Video editing
  { title: 'Cut and color-grade September webinar recording', domain: 'video' },
  { title: 'Trim intro/outro for Module 3 lesson pack', domain: 'video' },
  { title: 'Add captions to "Getting Started" welcome video', domain: 'video' },
  { title: 'Re-edit Sales VSL with new pricing', domain: 'video', priority: 'HIGH' },
  { title: 'Deliver TikTok cutdowns for Q4 campaign', domain: 'video' },
  { title: 'Fix audio sync on Chapter 7 lesson', domain: 'video' },

  // Graphic design
  { title: 'Design new certificate template (v3)', domain: 'graphic' },
  { title: 'Refresh course thumbnail set for Business track', domain: 'graphic' },
  { title: 'Build carousel graphics for LinkedIn launch', domain: 'graphic', priority: 'HIGH' },
  { title: 'Update brand kit with dark-mode variants', domain: 'graphic' },
  { title: 'Design email header for weekly digest', domain: 'graphic' },
  { title: 'Icon pack for onboarding checklist', domain: 'graphic', priority: 'LOW' },

  // WordPress
  { title: 'Sync marketing site copy with new pricing page', domain: 'wordpress' },
  { title: 'Debug Contact Form 7 spam surge', domain: 'wordpress', priority: 'HIGH' },
  { title: 'Update Elementor global styles to match brand kit', domain: 'wordpress' },
  { title: 'Fix 404s from old /blog permalinks', domain: 'wordpress' },
  { title: 'Add Woo checkout upsell block', domain: 'wordpress' },

  // GoHighLevel
  { title: 'Rebuild lead nurture workflow for cohort 12', domain: 'ghl' },
  { title: 'Set up SMS drip for abandoned checkout', domain: 'ghl' },
  { title: 'Migrate old Mailgun templates to GHL emails', domain: 'ghl' },
  { title: 'Fix pipeline stage automation firing twice', domain: 'ghl', priority: 'HIGH' },
  { title: "Configure calendar sync for Ruby's discovery calls", domain: 'ghl' },

  // Payments
  { title: 'Reconcile Stripe payouts for October', domain: 'payments' },
  { title: 'Investigate failed subscription renewal from customer #4381', domain: 'payments', priority: 'CRITICAL' },
  { title: 'Add refund workflow to admin dashboard', domain: 'payments' },
  { title: 'Set up dunning email schedule in Stripe', domain: 'payments' },
  { title: 'Audit annual-plan discount coupons still active', domain: 'payments' },

  // AR (accounts receivable)
  { title: 'Follow up on 3 overdue invoices from September', domain: 'ar', priority: 'HIGH' },
  { title: 'Chase payment: Client X (60 days past due)', domain: 'ar', priority: 'HIGH' },
  { title: 'Send monthly aged AR summary to Keanu', domain: 'ar' },
  { title: 'Reconcile Wise vs Stripe deposits', domain: 'ar' },

  // Revamp
  { title: 'Homepage revamp — draft new hero + testimonial section', domain: 'revamp' },
  { title: 'Revamp signup flow: reduce form fields', domain: 'revamp' },
  { title: 'Course library revamp — new grid layout', domain: 'revamp' },
  { title: 'Revamp onboarding checklist to be role-aware', domain: 'revamp' },

  // Meetings
  { title: 'Prep agenda for Monday leadership sync', domain: 'meeting' },
  { title: 'Notes + action items from Q4 planning offsite', domain: 'meeting' },
  { title: '1:1 with Michael — quarterly review', domain: 'meeting' },
  { title: 'Client kickoff call: new enrollment cohort', domain: 'meeting' },

  // Cold calling / outreach
  { title: 'Call 20 warm leads from webinar signup', domain: 'call' },
  { title: 'Follow up cold outbound list (batch 5)', domain: 'call' },
  { title: "Reach out to students who didn't complete onboarding", domain: 'call' },
  { title: 'Objection-handling script iteration v2', domain: 'call', priority: 'LOW' },

  // Ops / misc
  { title: 'Data entry: import 800 leads from Zapier export', domain: 'ops' },
  { title: 'Backup verification for last quarter', domain: 'ops' },
  { title: 'Slack integration: pipe form submissions', domain: 'ops' },
  { title: 'Update team availability calendar for holidays', domain: 'ops' },
  { title: 'Set up Loom for training-video capture', domain: 'ops' },
  { title: 'Coach Jeanne on new dashboard walkthrough', domain: 'ops' },
  { title: 'Ops: renew domain + SSL for staging', domain: 'ops', priority: 'HIGH' },
  { title: 'Q4 OKR checkpoint doc', domain: 'ops' },
  { title: 'New employee onboarding template', domain: 'ops' },
  { title: 'Legal: review updated terms of service', domain: 'ops', priority: 'CRITICAL' },
]

/** Assignee bias per domain — first name matches the ADMIN roster
 *  in Kondense so tasks land somewhere sensible when a random
 *  choice needs a nudge. Fallback: rotate through everyone. */
const DOMAIN_BIAS: Record<Domain, string[]> = {
  development: ['Ruby', 'Ruel'],
  video: ['Michael', 'Gillian'],
  graphic: ['Gillian', 'Michael'],
  wordpress: ['Ruby', 'Ruel'],
  ghl: ['Kyle', 'Keanu'],
  payments: ['Jeanne', 'Keanu'],
  ar: ['Jeanne'],
  revamp: ['Ruby', 'Gillian'],
  meeting: ['Keanu', 'Ruel', 'Ruby'],
  call: ['Kyle'],
  ops: ['Ruel', 'Keanu'],
}

/** Category name → real category row in the DB. Missing keys fall
 *  back to null (no category). */
const DOMAIN_CATEGORY: Record<Domain, string | null> = {
  development: 'Enhancement',
  video: 'Feature',
  graphic: 'Feature',
  wordpress: 'Enhancement',
  ghl: 'Enhancement',
  payments: 'Ops',
  ar: 'Ops',
  revamp: 'Enhancement',
  meeting: 'Documentation',
  call: 'Ops',
  ops: 'Ops',
}

/** Label bias by domain — labels are additive, may pick 0–2. */
const DOMAIN_LABELS: Record<Domain, string[]> = {
  development: ['backend', 'frontend', 'database', 'api'],
  video: [],
  graphic: ['frontend'],
  wordpress: ['frontend', 'infrastructure'],
  ghl: ['api', 'infrastructure'],
  payments: ['api', 'urgent'],
  ar: ['urgent'],
  revamp: ['frontend'],
  meeting: [],
  call: [],
  ops: ['infrastructure'],
}

const STATUS_WEIGHTS = [
  { slug: 'backlog',    weight: 24 },
  { slug: 'todo',       weight: 26 },
  { slug: 'in-progress', weight: 24 },
  { slug: 'in-review',  weight: 10 },
  { slug: 'blocked',    weight: 6 },
  { slug: 'done',       weight: 10 },
] as const

const PRIORITY_WEIGHTS = [
  { value: 'CRITICAL' as const, weight: 8 },
  { value: 'HIGH' as const,     weight: 24 },
  { value: 'MEDIUM' as const,   weight: 52 },
  { value: 'LOW' as const,      weight: 16 },
]

function pickWeighted<T extends { weight: number }>(
  entries: readonly T[],
  rand: number,
): T {
  const total = entries.reduce((sum, e) => sum + e.weight, 0)
  let cursor = rand * total
  for (const entry of entries) {
    cursor -= entry.weight
    if (cursor <= 0) return entry
  }
  return entries[entries.length - 1]!
}

function pickRandom<T>(arr: T[], rand: number): T {
  return arr[Math.floor(rand * arr.length)]!
}

/** Deterministic-ish RNG so re-runs produce a similar spread. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function main() {
  const { prisma } = await import('@/lib/prisma')

  // Load team, statuses, categories, labels for the target tenant.
  const [team, statuses, categories, labels] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'TEAM'] },
        deletedAt: null,
        isActive: true,
        companyMemberships: { some: { companyId: KONDENSE_ID } },
      },
      select: { id: true, name: true },
    }),
    prisma.taskStatus.findMany({
      where: { companyId: KONDENSE_ID },
      select: { id: true, slug: true },
    }),
    prisma.taskCategory.findMany({
      where: { companyId: KONDENSE_ID },
      select: { id: true, name: true },
    }),
    prisma.taskLabel.findMany({
      where: { companyId: KONDENSE_ID },
      select: { id: true, name: true },
    }),
  ])

  const statusBySlug = new Map(statuses.map((s) => [s.slug, s.id]))
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]))
  const labelByName = new Map(labels.map((l) => [l.name, l.id]))
  const teamByFirstName = new Map<string, string>()
  for (const u of team) {
    const first = (u.name ?? '').split(' ')[0]
    if (first) teamByFirstName.set(first, u.id)
  }

  console.log(`tenant: Kondense (${KONDENSE_ID})`)
  console.log(`team: ${team.length}, statuses: ${statuses.length}, categories: ${categories.length}, labels: ${labels.length}`)

  // Wipe prior seed rows so the script is safely re-runnable.
  const wiped = await prisma.task.deleteMany({
    where: { companyId: KONDENSE_ID, title: { startsWith: '[SEED] ' } },
  })
  console.log(`wiped prior seed rows: ${wiped.count}`)

  const rand = mulberry32(20260717)
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000

  let inserted = 0
  for (let i = 0; i < DRAFTS.length; i++) {
    const draft = DRAFTS[i]!
    // Status.
    const statusPick = pickWeighted(STATUS_WEIGHTS, rand())
    const statusId = statusBySlug.get(statusPick.slug)
    if (!statusId) {
      console.warn(`skip: no status "${statusPick.slug}"`)
      continue
    }
    // Priority.
    const priority = draft.priority ?? pickWeighted(PRIORITY_WEIGHTS, rand()).value
    // Category.
    const catName = DOMAIN_CATEGORY[draft.domain]
    const categoryId = catName ? categoryByName.get(catName) ?? null : null
    // Assignee — biased by domain, fallback to random team member.
    const bias = DOMAIN_BIAS[draft.domain] ?? []
    let assigneeId: string | undefined
    for (const first of bias) {
      const id = teamByFirstName.get(first)
      if (id) {
        assigneeId = id
        break
      }
    }
    if (!assigneeId && team.length > 0) {
      assigneeId = team[Math.floor(rand() * team.length)]!.id
    }
    // ~30% of tasks get a second assignee (multi-assignee case).
    const assigneeIds = new Set<string>()
    if (assigneeId) assigneeIds.add(assigneeId)
    if (team.length > 1 && rand() < 0.3) {
      let tries = 4
      while (tries-- > 0) {
        const pick = team[Math.floor(rand() * team.length)]!.id
        if (!assigneeIds.has(pick)) {
          assigneeIds.add(pick)
          break
        }
      }
    }
    // Labels — up to 2 from the domain's bias set.
    const labelPool = DOMAIN_LABELS[draft.domain] ?? []
    const labelIds = new Set<string>()
    for (const name of labelPool) {
      if (rand() < 0.5) {
        const id = labelByName.get(name)
        if (id) labelIds.add(id)
      }
      if (labelIds.size >= 2) break
    }
    // Urgent label auto-attached to CRITICAL rows if present.
    if (priority === 'CRITICAL' && labelByName.has('urgent')) {
      labelIds.add(labelByName.get('urgent')!)
    }
    // Due date — a spread: 20% overdue, 25% within 3d, 25% within
    // 2wk, 30% no due date.
    let dueDate: Date | null = null
    const r = rand()
    if (r < 0.2) dueDate = new Date(now - Math.floor(rand() * 14 + 1) * day)
    else if (r < 0.45) dueDate = new Date(now + Math.floor(rand() * 3) * day)
    else if (r < 0.7) dueDate = new Date(now + Math.floor(rand() * 14 + 4) * day)

    // Reporter — half the time the first assignee, half the time
    // random. Keeps activity + notifications feeling natural.
    const reporterId =
      rand() < 0.5
        ? assigneeIds.values().next().value ?? null
        : team[Math.floor(rand() * team.length)]?.id ?? null

    await prisma.task.create({
      data: {
        title: `[SEED] ${draft.title}`,
        description: null,
        companyId: KONDENSE_ID,
        statusId,
        priority,
        categoryId,
        reporterId,
        dueDate,
        orderIndex: (i + 1) * 100,
        assignees: {
          create: Array.from(assigneeIds).map((userId) => ({
            userId,
            companyId: KONDENSE_ID,
          })),
        },
        watchers: reporterId
          ? {
              create: [{ userId: reporterId, companyId: KONDENSE_ID }],
            }
          : undefined,
        labels: {
          create: Array.from(labelIds).map((labelId) => ({
            labelId,
            companyId: KONDENSE_ID,
          })),
        },
      },
    })
    inserted++
  }

  console.log(`\nseeded ${inserted} tasks across ${team.length} members.`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
