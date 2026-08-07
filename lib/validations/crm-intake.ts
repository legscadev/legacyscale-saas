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
  /** Write mode.
   *  - `create` (default) spawns a new opportunity in the target stage.
   *  - `partial` captures a half-finished application (step 1: name +
   *    email + phone) into the `Partial` stage so an abandoned lead is
   *    still saved. No closer notification fires — it lands silently in
   *    the Partial column.
   *  - `promote` advances that partial deal into the target stage (New
   *    Lead) and enriches it with the full answers when the applicant
   *    finishes. Falls back to `create` when there's no partial deal.
   *  - `append` finds the existing contact by email and appends
   *    `answers` to their most recent opportunity's notes — used for the
   *    Instagram-handle capture on the success screen. Falls back to
   *    `create` when no prior opportunity exists. */
  mode: z
    .enum(['create', 'append', 'partial', 'promote'])
    .optional()
    .default('create'),
  /** Target stage name within the pipeline (case-insensitive). `partial`
   *  routes to "Partial", `promote`/`create` to "New Lead". Falls back to
   *  the pipeline's first stage when omitted or unmatched. */
  stage: shortText(100),
  /** Existing opportunity id — the precise promote target returned by the
   *  earlier `partial` write. Falls back to latest-by-email when omitted. */
  opportunityId: z
    .string()
    .trim()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  /** Arbitrary form answers keyed by question. Dumped into the
   *  opportunity's description so the closer sees full context. */
  answers: z.record(z.string(), z.unknown()).optional(),
})
export type LeadIntakeInput = z.output<typeof leadIntakeSchema>
