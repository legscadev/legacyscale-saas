# CRM Intake Webhook

Public HTTPS endpoint that spawns a **Contact** and an **Opportunity**
in Kondense from any external form or funnel (landing pages, Zapier,
Meta Lead Ads, Facebook / Instagram forms via a middleware, etc.).

## Endpoint

```
POST https://kondense.ai/api/crm/intake
```

## Headers

| Header | Required | Value |
|---|---|---|
| `Content-Type` | yes | `application/json` |
| `x-intake-token` | yes | The value of the `CRM_INTAKE_TOKEN` env var set in Vercel. Rotate on suspicion of leak. |

Wrong or missing token → **401 Unauthorized**.

## Request body

```jsonc
{
  "name": "Jane Doe",                      // required, ≤ 200 chars
  "email": "jane@acme.com",                // optional
  "phone": "+15550100",                    // optional
  "companyName": "Acme Corp",              // optional
  "source": "100k Marketing Program",      // free text, stamped on the deal
  "campaign": "Q3 landing page",           // optional, stamped on the contact
  "answers": {                             // optional key/value map
    "currentRevenue": "$50k/mo",
    "industry": "Agency",
    "bookingUrgency": "asap"
  }
}
```

Validation failures → **422 Unprocessable Entity** with per-field
messages under `fieldErrors`.

## What happens on success (**200 OK**)

1. Contact is **found or created** on `crm_leads` (deduped by email,
   fallback name + company). Response includes its `contactId`.
2. Opportunity is **created** in the tenant's **default pipeline**
   at the first stage. Response includes its `opportunityId`.
   - `name` = `"{contactName} — {source}"` (max 200 chars)
   - `source` = the payload's `source` (defaults to `"Landing page"`)
   - `notes` = `campaign` + a pretty-printed dump of `answers`
   - `contactId` links the deal to the Contact row from step 1
3. If `campaign` was supplied, the contact's `campaign` field is
   updated and `lastActivityAt` is bumped so it surfaces in recent-
   activity sorts.

Response:

```json
{ "ok": true, "contactId": "…", "opportunityId": "…" }
```

## Landing-page snippet

The current form on `legacyscale.co/100kmarketingprogram` has
**two** `TODO: send ... to your CRM / webhook here` blocks:

1. After the Step 1 contact form submits (would capture bailers).
2. Inside `finish()` after all 4 quiz steps complete.

**Wire only the second one** (the `finish()` TODO). A single POST
per completed submission is the simplest pattern with zero
duplicate risk. Bailers who fill Step 1 and drop mid-quiz will not
be captured — worth it for the simplicity. Ping if you want bailer
capture later; we'll add an `upsert` mode to the endpoint.

The form's answer keys today: `name`, `email`, `phone`,
`situation`, `savings`, `credit`, `timeline`. The quiz keys use
short codes as values — this snippet maps them back to the button
labels the user actually saw, so the notes on the deal card read
as full sentences rather than `savings: high`.

```html
<script>
  // Set at build time or inject from your hosting env. Do NOT
  // commit this token into a public repo.
  const CRM_INTAKE_TOKEN = 'REPLACE_WITH_YOUR_TOKEN'
  const CRM_INTAKE_URL = 'https://kondense.ai/api/crm/intake'

  // Value → button-text map. Add rows here if you add more quiz options.
  const ANSWER_LABELS = {
    situation: {
      college: "I'm in college / school",
      job: 'Working a 9–5',
      business: 'Trying to get a business off the ground',
      between: 'In between things at the moment',
    },
    savings: {
      high: "I've got $5K+ put away",
      mid: 'Somewhere between $1K and $5K',
      low: 'Less than $1K saved right now',
      zero: 'Basically starting from zero',
    },
    credit: {
      good: 'Solid — 700 or better',
      mid: 'Decent — somewhere in the 600s',
      low: "It's a work in progress",
      unknown: 'Honestly, no idea',
    },
    timeline: {
      now: "Yesterday. I'm ready now",
      soon: 'Within the next 30 days',
      months: 'A few months out',
      looking: 'Just looking around for now',
    },
  }

  function humaniseAnswers(answers) {
    const out = { ...answers }
    for (const key of Object.keys(ANSWER_LABELS)) {
      if (out[key] && ANSWER_LABELS[key][out[key]]) {
        out[key] = ANSWER_LABELS[key][out[key]]
      }
    }
    return out
  }

  async function sendToKondense(answers) {
    try {
      const res = await fetch(CRM_INTAKE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-intake-token': CRM_INTAKE_TOKEN,
        },
        body: JSON.stringify({
          name: answers.name,
          email: answers.email,
          phone: answers.phone,
          source: '100k Marketing Program',
          campaign: 'landing-page-2026',
          // Quiz answers ride along here; pretty-printed on the
          // deal card as "Savings: I've got $5K+ put away", etc.
          answers: humaniseAnswers(answers),
        }),
      })
      if (!res.ok) console.warn('[Kondense intake]', await res.text())
    } catch (err) {
      // Don't block the booking flow if the intake POST fails.
      console.error('[Kondense intake] network error', err)
    }
  }
</script>
```

Drop `sendToKondense(answers)` inside `finish()` as the first line —
fire-and-forget so a slow API call doesn't stall the qualified /
downsell branching that follows.

## Env vars

| Name | Required | Purpose |
|---|---|---|
| `CRM_INTAKE_TOKEN` | yes | Shared secret checked against the `x-intake-token` header. |
| `CRM_INTAKE_COMPANY_ID` | no | Override the tenant the intake writes into. Defaults to the platform seed tenant (Kondense). Set this if you point the endpoint at a non-primary tenant. |

Set both on Vercel (Project → Settings → Environment Variables) for
Production and Preview. Local dev already has one in `.env.local`.

## Adding more forms / funnels later

The endpoint is **source-agnostic**. Any form can hit it — the only
thing that changes is the payload's `source` string. Filter the
Opportunities board by `source=…` to segregate leads per funnel.

If you later need each source to route to a **different pipeline**
or **default assignee**, we'll add a Sources admin surface that
maps `source` → `{ pipelineId, assigneeId }`. Ping when you need
that.

## Testing

```bash
curl -s -X POST https://kondense.ai/api/crm/intake \
  -H 'Content-Type: application/json' \
  -H "x-intake-token: $CRM_INTAKE_TOKEN" \
  -d '{
    "name": "Test Lead",
    "email": "test@example.com",
    "source": "curl test"
  }'
```

Expect `{"ok":true,"contactId":"…","opportunityId":"…"}` and a new
card in `/admin/crm/opportunities`.
