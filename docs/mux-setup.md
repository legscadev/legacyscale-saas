# Mux dev setup

Operational steps to wire Mux for local development. Required before
working on any video lesson features (Sprint 2 Phase D and later).

## 1. Env vars

In `.env.local`:

```
MUX_TOKEN_ID=...        # Mux dashboard → Settings → Access Tokens
MUX_TOKEN_SECRET=...    # Same screen; shown once at creation
MUX_WEBHOOK_SECRET=...  # Set in step 3 below
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Use a token scoped to the **Development** environment in the Mux
dashboard so smoke uploads don't hit your production billing.

Sanity-check credentials with a one-shot script:

```bash
cat > .mux-ping.ts <<'EOF'
import Mux from '@mux/mux-node'
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})
mux.video.assets.list({ limit: 1 }).then(
  (p) => console.log(`ok — ${(p.data ?? []).length} asset(s)`),
  (e) => { console.error(e); process.exit(1) },
)
EOF
pnpm dotenv -e .env.local -- tsx .mux-ping.ts
rm .mux-ping.ts
```

## 2. Public tunnel

Mux delivers webhooks to a public URL, so `localhost` won't do during
development. Pick one:

- **ngrok** — `ngrok http 3000`. Free plan: URL changes each restart.
- **Cloudflare Tunnel** — `cloudflared tunnel --url http://localhost:3000`.
- **Next.js dev tunnel** — built into `next dev` via the `--experimental-https`
  flag combined with a tunneling service; less ergonomic than the above.

Note the public URL — e.g. `https://abcd-1234.ngrok-free.app`.

## 3. Webhook in Mux dashboard

1. Mux dashboard → Settings → Webhooks → **Create new webhook**.
2. URL: `<tunnel-url>/api/webhooks/mux`.
3. Environment: **Development**.
4. Copy the signing secret it displays → paste into `MUX_WEBHOOK_SECRET`
   in `.env.local` and restart `pnpm dev`.

The handler at `app/api/webhooks/mux/route.ts`:
- Verifies the signature in every environment when `MUX_WEBHOOK_SECRET`
  is set.
- In `development`, skips verification when the secret is empty (so cURL
  tests work). In `production` it hard-fails when the secret is missing.

## 4. End-to-end smoke test

The full UI flow (admin uploads a video → webhook fires → lesson row
flips to `READY`) isn't wired until Sprint 2 Phase D (ticket 2.10).
Until then, test the webhook by hand:

1. Insert a stub lesson row with `type: VIDEO`, `status: DRAFT`.
2. Mux dashboard → **Direct upload** (the "for testing" widget); paste
   the lesson `id` into the `passthrough` field.
3. Drop a small test video. Watch the lesson row transition
   `DRAFT` → `PROCESSING` → `READY` with `muxAssetId`,
   `muxPlaybackId`, and `durationSeconds` populated.

## When the tunnel URL changes

Free ngrok URLs rotate on every `ngrok` restart. Each time:

1. Restart `ngrok http 3000` and grab the new URL.
2. Update the webhook URL in the Mux dashboard (Settings → Webhooks
   → edit the dev webhook).

If you switch to a paid plan with a reserved subdomain, this step
goes away.

## Cleanup

In `lib/mux.ts`, `deleteAsset(assetId)` calls
`mux.video.assets.delete(...)`. Used by:

- Sprint 2 / 2.14 — replace video on a lesson.
- Sprint 2 / 2.15 — delete a lesson.

Cascade deletes from `Chapter` or `Course` do **not** call this — they
remove the lesson row only. Mux orphans must be cleaned manually for
now (tracked as tech debt in `planning/SPRINT_2/PHASE_C_CHAPTER_SLICE.md`).
