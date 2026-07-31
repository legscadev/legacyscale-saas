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

Drop this in the `TODO: send full 'answers' object to your CRM /
webhook here` block of the existing `qmodalForm` handler on
`legacyscale.co/100kmarketingprogram`:

```html
<script>
  // Set at build time or inject from your hosting env. Do NOT
  // commit this token into a public repo.
  const CRM_INTAKE_TOKEN = 'REPLACE_WITH_YOUR_TOKEN'
  const CRM_INTAKE_URL = 'https://kondense.ai/api/crm/intake'

  async function sendToKondense(answers) {
    try {
      const res = await fetch(CRM_INTAKE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-intake-token': CRM_INTAKE_TOKEN,
        },
        body: JSON.stringify({
          // Pull the standard fields directly; the rest of the
          // qmodalForm answers ride along in `answers`.
          name: answers.name,
          email: answers.email,
          phone: answers.phone,
          companyName: answers.company,
          source: '100k Marketing Program',
          campaign: 'landing-page-2026',
          answers,
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

Call `sendToKondense(answers)` right after your existing validation
succeeds and before you open the Calendly/GHL booking link. It's
fire-and-forget so a slow API call doesn't stall the user.

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
