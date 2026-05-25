# Phase 0 — Master Checklist

## Overview

This checklist tracks all Phase 0 (Sprint 0) foundation tasks for the Legacy Scale SaaS platform. Complete all tasks before proceeding to Phase 1 feature development.

**Total Tasks:** 16
**Estimated Time:** 40 hours
**Priority Focus:** P1 tasks are blockers for Phase 1

---

## Quick Status

| Status | Count |
|--------|-------|
| Pending | 16 |
| In Progress | 0 |
| Completed | 0 |

---

## Task List

### Core Setup (P1 - Critical Path)

| # | Task | File | Priority | Time | Status |
|---|------|------|----------|------|--------|
| 0.1 | Initialize Next.js 14 Project | `0.1-nextjs-init.md` | P1 | 1h | [ ] |
| 0.2 | Configure Tailwind + ShadCN/UI | `0.2-tailwind-shadcn.md` | P1 | 2h | [ ] |
| 0.3 | Set Up Supabase Project | `0.3-supabase-project.md` | P1 | 1h | [ ] |
| 0.4 | Design Database Schema | `0.4-database-schema.md` | P1 | 4h | [ ] |
| 0.5 | Prisma Init + Migrate | `0.5-prisma-setup.md` | P1 | 3h | [ ] |
| 0.6 | Configure RLS Policies | `0.6-rls-policies.md` | P1 | 3h | [ ] |
| 0.7 | Deploy to Vercel | `0.7-vercel-deploy.md` | P1 | 1h | [ ] |

### Authentication (P1 - Critical Path)

| # | Task | File | Priority | Time | Status |
|---|------|------|----------|------|--------|
| 0.8 | Set Up Supabase Auth | `0.8-supabase-auth.md` | P1 | 1h | [ ] |
| 0.14 | Auth Middleware | `0.14-auth-middleware.md` | P1 | 3h | [ ] |

### UI Foundation (P1-P2)

| # | Task | File | Priority | Time | Status |
|---|------|------|----------|------|--------|
| 0.9 | Layout Components | `0.9-layout-components.md` | P1 | 6h | [ ] |
| 0.10 | Design System | `0.10-design-system.md` | P2 | 5h | [ ] |
| 0.11 | Route Structure | `0.11-route-structure.md` | P1 | 3h | [ ] |
| 0.15 | Error Pages | `0.15-error-pages.md` | P3 | 2h | [ ] |

### External Services (P1-P2)

| # | Task | File | Priority | Time | Status |
|---|------|------|----------|------|--------|
| 0.12 | Mux Configuration | `0.12-mux-config.md` | P1 | 1h | [ ] |
| 0.13 | Resend Email | `0.13-resend-email.md` | P2 | 3h | [ ] |

### Utilities (P1)

| # | Task | File | Priority | Time | Status |
|---|------|------|----------|------|--------|
| 0.16 | Zod Validation | `0.16-zod-validation.md` | P1 | 1h | [ ] |

---

## Execution Order

Follow this sequence for optimal execution:

```
WEEK 1 (Day 1-2): Core Setup
─────────────────────────────
[1] 0.1 - Next.js Init          ← Start here
[2] 0.3 - Supabase Project      ← Need connection string
[3] 0.2 - Tailwind + ShadCN     ← UI framework

WEEK 1 (Day 2-3): Database
─────────────────────────────
[4] 0.4 - Database Schema       ← Design all tables
[5] 0.5 - Prisma Setup          ← Push to database
[6] 0.7 - Deploy to Vercel      ← Verify basic deploy

WEEK 1 (Day 3-4): Security
─────────────────────────────
[7] 0.6 - RLS Policies          ← Secure database
[8] 0.8 - Supabase Auth         ← Auth setup
[9] 0.16 - Zod Validation       ← API validation

WEEK 1 (Day 4-5): Auth & Routes
─────────────────────────────
[10] 0.14 - Auth Middleware     ← Route protection
[11] 0.9 - Layout Components    ← Sidebars, nav
[12] 0.10 - Design System       ← UI components

WEEK 2 (Day 1-2): Routes & Services
─────────────────────────────
[13] 0.11 - Route Structure     ← All pages
[14] 0.12 - Mux Config          ← Video service
[15] 0.13 - Resend Email        ← Email service

WEEK 2 (Day 2): Polish
─────────────────────────────
[16] 0.15 - Error Pages         ← 404, 500, etc.
```

---

## Parallel Tracks

If working with multiple developers or want to parallelize:

```
TRACK A: Core App
0.1 → 0.2 → 0.9 → 0.10 → 0.11 → 0.15

TRACK B: Database
0.3 → 0.4 → 0.5 → 0.6

TRACK C: Auth
0.8 → 0.14

TRACK D: Services (after 0.1)
0.12, 0.13, 0.16
```

---

## Dependencies Graph

```
0.1 Next.js Init
 │
 ├── 0.2 Tailwind + ShadCN
 │    └── 0.9 Layout Components
 │         └── 0.10 Design System
 │              └── 0.11 Route Structure
 │                   └── 0.15 Error Pages
 │
 ├── 0.3 Supabase Project
 │    ├── 0.4 Database Schema
 │    │    └── 0.5 Prisma Setup
 │    │         └── 0.6 RLS Policies
 │    │
 │    └── 0.8 Supabase Auth
 │         └── 0.14 Auth Middleware
 │
 ├── 0.7 Vercel Deploy (after 0.2)
 │
 ├── 0.12 Mux Config
 │
 ├── 0.13 Resend Email
 │
 └── 0.16 Zod Validation
```

---

## Environment Variables Checklist

After completing all tasks, verify these are set:

### `.env.local`

```bash
# Supabase
[ ] NEXT_PUBLIC_SUPABASE_URL=
[ ] NEXT_PUBLIC_SUPABASE_ANON_KEY=
[ ] SUPABASE_SERVICE_ROLE_KEY=

# Database
[ ] DATABASE_URL=

# Mux
[ ] MUX_TOKEN_ID=
[ ] MUX_TOKEN_SECRET=
[ ] MUX_WEBHOOK_SECRET=

# Resend
[ ] RESEND_API_KEY=
[ ] RESEND_FROM_EMAIL=

# App
[ ] NEXT_PUBLIC_APP_URL=
```

### Vercel Environment Variables

Ensure all above variables are added to Vercel project settings.

---

## Final Verification Checklist

Before moving to Phase 1, verify:

### Application

- [ ] `pnpm dev` runs without errors
- [ ] `pnpm build` completes successfully
- [ ] `pnpm lint` passes
- [ ] No TypeScript errors

### Deployment

- [ ] Vercel deployment is green
- [ ] Production URL is accessible
- [ ] `/api/health` returns success

### Database

- [ ] All 10 tables created in Supabase
- [ ] RLS policies applied
- [ ] Seed data exists (admin user, sample course)

### Authentication

- [ ] Login page renders
- [ ] Signup creates user in both Auth and database
- [ ] Middleware redirects unauthenticated users
- [ ] Admin routes protected from members

### UI

- [ ] Admin sidebar renders
- [ ] User sidebar renders
- [ ] Mobile navigation works
- [ ] Dark theme applied
- [ ] Loading states work
- [ ] Error pages display correctly

### External Services

- [ ] Mux API credentials work
- [ ] Resend can send test email
- [ ] Webhooks configured

---

## Project Structure After Phase 0

```
legacyscale-saas/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── (admin)/admin/
│   │   ├── members/
│   │   ├── courses/
│   │   ├── announcements/
│   │   └── settings/
│   ├── (user)/
│   │   ├── dashboard/
│   │   ├── courses/
│   │   ├── announcements/
│   │   └── profile/
│   ├── api/
│   │   ├── auth/
│   │   ├── health/
│   │   ├── uploads/
│   │   ├── webhooks/
│   │   └── emails/
│   ├── auth/
│   │   ├── callback/
│   │   └── auth-code-error/
│   ├── access-revoked/
│   ├── unauthorized/
│   ├── maintenance/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── loading.tsx
│   ├── not-found.tsx
│   ├── error.tsx
│   └── global-error.tsx
├── components/
│   ├── ui/           # ShadCN components
│   ├── layout/       # Sidebar, nav
│   ├── shared/       # Loading, empty state
│   ├── video/        # Mux player
│   └── auth/         # Protected route
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── auth/
│   │   ├── actions.ts
│   │   ├── get-user.ts
│   │   ├── sync-user.ts
│   │   └── use-auth.ts
│   ├── config/
│   │   └── navigation.ts
│   ├── validations/
│   │   ├── common.ts
│   │   ├── auth.ts
│   │   ├── user.ts
│   │   ├── course.ts
│   │   └── announcement.ts
│   ├── api/
│   │   └── helpers.ts
│   ├── prisma.ts
│   ├── mux.ts
│   ├── resend.ts
│   └── utils.ts
├── emails/
│   ├── welcome.tsx
│   ├── password-reset.tsx
│   └── announcement.tsx
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── rls-policies.sql
├── middleware.ts
├── .env.local
├── .env.example
├── tailwind.config.ts
├── next.config.js
├── tsconfig.json
└── package.json
```

---

## Ready for Phase 1?

When all checkboxes above are complete:

1. Run final verification
2. Create git commit: `git commit -m "feat: complete Phase 0 foundation"`
3. Create git tag: `git tag v0.1.0-foundation`
4. Push to remote: `git push && git push --tags`
5. Begin Phase 1: Member Authentication

---

## Support

If you encounter issues:

1. Check the troubleshooting section in each task file
2. Verify environment variables
3. Check Vercel deployment logs
4. Check Supabase dashboard for database issues

---

**Phase 0 Complete!** You now have a solid foundation for building the Legacy Scale platform.
