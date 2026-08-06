// Public webhook payload for /api/crm/intake. External forms +
// landing pages POST this shape to spawn a Contact + Opportunity
// in Kondense. Everything except `name` is optional so a bare-bones
// form (name only) still works.

import { z } from 'zod'

const shortText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined))

export const leadIntakeSchema = z.object({
  /** Full name — the only required field. */
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z
    .string()
    .trim()
    .max(320)
    .email('Invalid email')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: shortText(50),
  companyName: shortText(200),
  /** Free-text source label — surfaces on both the opportunity's
   *  `source` column and the contact's `campaign` field so filters
   *  like source="100k Marketing Program" work on both pages. */
  source: shortText(100),
  /** Optional campaign / ad-set tag; stored on the contact. */
  campaign: shortText(200),
  /** Optional pipeline id to route the deal into. When omitted (or
   *  unknown), the intake falls back to the tenant's default pipeline.
   *  Lets one endpoint serve many funnels — each posts its own id. */
  pipeline: z
    .string()
    .trim()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  /** Write mode. `create` (default) spawns a new opportunity. `append`
   *  finds the existing contact by email and appends `answers` to their
   *  most recent opportunity's notes — used for follow-up steps (e.g. an
   *  Instagram-handle capture on the success screen) so they enrich the
   *  original deal instead of spawning a duplicate. Falls back to
   *  `create` when no prior opportunity exists. */
  mode: z.enum(['create', 'append']).optional().default('create'),
  /** Arbitrary form answers keyed by question. Dumped into the
   *  opportunity's description so the closer sees full context. */
  answers: z.record(z.string(), z.unknown()).optional(),
})
export type LeadIntakeInput = z.output<typeof leadIntakeSchema>
