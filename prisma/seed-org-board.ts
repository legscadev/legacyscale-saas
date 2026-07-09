import type { OrgNodeKind, PrismaClient } from '@prisma/client'

/**
 * Canonical Hubbard 7-division org board scaffold. We seed the tree
 * matching the Makh reference: Founder + ED + Deputy + VP crown,
 * seven coloured divisions each with three standard departments.
 * Positions and employee assignments are intentionally left blank —
 * admins fill those in through the UI.
 */

const DIVISION_PALETTE: Record<number, string> = {
  7: 'blue',
  1: 'amber',
  2: 'indigo',
  3: 'pink',
  4: 'emerald',
  5: 'slate',
  6: 'yellow',
}

interface SeedDept {
  number: number
  label: string
  directorTitle: string
}

interface SeedDivision {
  number: number
  label: string
  directorTitle: string
  depts: SeedDept[]
  functionText?: string
}

const DIVISIONS: SeedDivision[] = [
  {
    number: 7,
    label: 'Division 7 - Executive',
    directorTitle: 'Executive Director',
    functionText:
      "This division coordinates and supervises the organization's activities so it runs smoothly, produces its products efficiently and in abundance and delivers its products and services to individuals and the community in high quality.",
    depts: [
      {
        number: 21,
        label: 'SOURCE - Department 21 - Office of the Founder',
        directorTitle: 'Founder',
      },
      {
        number: 20,
        label: 'EXISTENCE - Department 20 - Office of Corporate Affairs',
        directorTitle: 'Corporate Affairs Director',
      },
      {
        number: 19,
        label: 'CONDITIONS - Department 19 - Office of the Executive Director',
        directorTitle: 'Executive Director',
      },
    ],
  },
  {
    number: 1,
    label: 'DIVISION 1 - Communications',
    directorTitle: 'Communications Director',
    depts: [
      {
        number: 1,
        label: 'RECOGNITION - Department 1 - Dept Routing & Personnel',
        directorTitle: 'Routing And Personnel Manager',
      },
      {
        number: 2,
        label: 'COMMUNICATION - Department 2 - Dept Of Communications',
        directorTitle: 'Communications Manager',
      },
      {
        number: 3,
        label: 'PERCEPTION - Department 3 - Dept Of Inspections & Reports',
        directorTitle: 'Inspections & Reports Manager',
      },
    ],
  },
  {
    number: 2,
    label: 'DIVISION 2 - Sales & Marketing',
    directorTitle: 'Sales & Marketing Director',
    depts: [
      {
        number: 4,
        label: 'ORIENTATION - Department 4 - Dept Of Promotion & Marketing',
        directorTitle: 'Promotions & Marketing Manager',
      },
      {
        number: 5,
        label: 'UNDERSTANDING - Department 5 - Dept of Publications',
        directorTitle: 'Publications Manager',
      },
      {
        number: 6,
        label: 'ENLIGHTENMENT - Department 6 - Dept Of Sales',
        directorTitle: 'Sales Director',
      },
    ],
  },
  {
    number: 3,
    label: 'Division 3 - Treasury',
    directorTitle: 'Treasury Director',
    depts: [
      {
        number: 7,
        label: 'ENERGY - Department 7 - Dept of Income',
        directorTitle: 'Income Manager',
      },
      {
        number: 8,
        label: 'ADJUSTMENT - Department 8 - Dept of Disbursements',
        directorTitle: 'Disbursements Manager',
      },
      {
        number: 9,
        label: 'BODY - Department 9 - Dept of Records, Assets & Material',
        directorTitle: 'Records, Assets & Material Manager',
      },
    ],
  },
  {
    number: 4,
    label: 'Division 4 - Delivery & Fulfilment',
    directorTitle: 'Delivery & Fulfillment Director',
    depts: [
      {
        number: 10,
        label: 'PREDICTION - Department 10 - Department of Production Services',
        directorTitle: 'Production Services Manager',
      },
      {
        number: 11,
        label: 'ACTIVITY - Department 11 - Department of Training',
        directorTitle: 'Training Manager',
      },
      {
        number: 12,
        label: 'PRODUCTION - Department 12 - Department of Client Development',
        directorTitle: 'Client Training Manager',
      },
    ],
  },
  {
    number: 5,
    label: 'Division 5 - Quality Control',
    directorTitle: 'Qualifications Director',
    depts: [
      {
        number: 13,
        label: 'VALIDITY - Department 13 - Dept of Verifications',
        directorTitle: 'Verifications Manager',
      },
      {
        number: 14,
        label: 'ENHANCEMENT - Department 14 - Dept of Resolutions & Employee Improvement',
        directorTitle: 'Employee Improvement Manager',
      },
      {
        number: 15,
        label: 'CORRECTION - Department 15 - Dept of Certifications and Awards',
        directorTitle: 'Correction Manager',
      },
    ],
  },
  {
    number: 6,
    label: 'Division 6 - Public',
    directorTitle: 'Division 6 Director',
    depts: [
      {
        number: 16,
        label: 'Intro Services - Department 16',
        directorTitle: 'Intro Services Manager',
      },
      {
        number: 17,
        label: 'Field Production - Department 17',
        directorTitle: 'Field Manager',
      },
      {
        number: 18,
        label: 'Public Outreach - Department 18',
        directorTitle: 'Community Outreach',
      },
    ],
  },
]

const CROWN_CHAIN: Array<{ label: string; positionTitle: string | null }> = [
  { label: 'Founder', positionTitle: null },
  { label: 'Executive Director', positionTitle: null },
  { label: 'Deputy Executive Director', positionTitle: null },
  { label: 'Vice President', positionTitle: null },
]

export async function seedOrgBoard(prisma: PrismaClient): Promise<void> {
  // If any revision already exists, leave it alone — the seed
  // should never clobber admin edits on re-run.
  const existing = await prisma.orgBoardRevision.findFirst()
  if (existing) {
    console.warn(
      `⏭  Org board seed skipped — revision "${existing.name}" already exists`,
    )
    return
  }

  const revision = await prisma.orgBoardRevision.create({
    data: {
      name: 'v1',
      description: 'Current organizing chart',
      isCurrent: true,
      publishedAt: new Date(),
    },
  })

  // Crown chain — no parent, ordered top to bottom.
  for (let i = 0; i < CROWN_CHAIN.length; i++) {
    const c = CROWN_CHAIN[i]!
    await prisma.orgNode.create({
      data: {
        revisionId: revision.id,
        parentId: null,
        kind: 'CROWN' satisfies OrgNodeKind,
        label: c.label,
        positionTitle: c.positionTitle,
        orderIndex: i,
      },
    })
  }

  // Divisions + departments. Divisions live under no parent (they
  // render as columns branching from the VP visually, but that's a
  // presentation detail — the DB model treats CROWN and DIVISION as
  // siblings at the root of the revision).
  for (let d = 0; d < DIVISIONS.length; d++) {
    const div = DIVISIONS[d]!
    const divNode = await prisma.orgNode.create({
      data: {
        revisionId: revision.id,
        parentId: null,
        kind: 'DIVISION' satisfies OrgNodeKind,
        label: div.label,
        positionTitle: div.directorTitle,
        deptNumber: div.number,
        color: DIVISION_PALETTE[div.number],
        functionText: div.functionText ?? null,
        orderIndex: d,
      },
    })

    for (let x = 0; x < div.depts.length; x++) {
      const dept = div.depts[x]!
      await prisma.orgNode.create({
        data: {
          revisionId: revision.id,
          parentId: divNode.id,
          kind: 'DEPARTMENT' satisfies OrgNodeKind,
          label: dept.label,
          positionTitle: dept.directorTitle,
          deptNumber: dept.number,
          orderIndex: x,
        },
      })
    }
  }

  console.warn(
    `✅ Seeded org board: revision "${revision.name}" with ${DIVISIONS.length} divisions and ${
      DIVISIONS.reduce((n, d) => n + d.depts.length, 0)
    } departments`,
  )
}
