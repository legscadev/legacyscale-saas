# Phase 0 Plan — Legacy Scale Platform

**Document Version:** 1.0
**Prepared For:** Keanu Vasquez / Legacy Scale
**Platform:** Agency Education SaaS (LMS + AI Tools + Community)
**Developer Context:** Solo Full-Stack Developer

---

## 1. Executive Summary

### 1.1 What is Phase 0?

Phase 0 is the **pre-development preparation phase** that occurs before any feature code is written. It establishes the technical foundation, validates architectural decisions, sets up infrastructure, and aligns all stakeholders on scope and expectations.

For a solo developer building a complex SaaS platform, Phase 0 is not optional — it is **risk mitigation**. Skipping it leads to costly rewrites, scope confusion, and infrastructure firefighting during feature sprints.

### 1.2 Why Phase 0 Matters for Legacy Scale

The Legacy Scale platform is ambitious:
- **17 modules** (7 Admin, 10 User) in the MVP alone
- **8 sprints** across 8 weeks at $12/hr = tight budget
- **Multiple third-party integrations**: Supabase Auth, Mux Video, GoHighLevel webhooks, Resend email
- **Critical business logic**: subscription gating, member activation, progress tracking

Without proper foundation work, you risk:
- Database schema rewrites mid-development
- Authentication edge cases breaking production
- Video upload pipeline failures blocking content delivery
- Webhook integration bugs preventing member activation

### 1.3 Expected Outcomes

By the end of Phase 0, you will have:

1. **Validated technical architecture** — stack decisions finalized, no second-guessing
2. **Working development environment** — local setup runs full stack in one command
3. **Production-ready infrastructure** — Vercel + Supabase configured for staging/production
4. **Database schema** — all tables designed, relationships defined, RLS policies planned
5. **Design system foundation** — Tailwind config, ShadCN components, brand tokens
6. **CI/CD pipeline** — automated deployments on push to main
7. **Third-party accounts configured** — Mux, Resend, Supabase, Vercel all ready
8. **Sprint 0 completed** — working skeleton deployed to production URL

### 1.4 Estimated Duration

**1 week (40 hours)** — aligned with the existing Sprint 0 allocation.

This is aggressive but achievable for a solo developer who:
- Has done this stack before
- Uses templates/boilerplates for common patterns
- Prioritizes "working" over "perfect"

### 1.5 Major Deliverables

| Deliverable | Description |
|-------------|-------------|
| Project repository | Next.js 14 + TypeScript, configured and deployed |
| Database schema | Prisma schema with all MVP tables |
| Auth flow skeleton | Login, logout, password reset routing |
| Admin/User layouts | Sidebar shells, route groups, auth guards |
| Design system | Tailwind config, ShadCN components, brand colors |
| Production URL | Working skeleton at app.legacyscale.co |
| Documentation | Architecture decisions, folder structure, dev setup |

---

## 2. Phase 0 Objectives

### 2.1 Product Objectives

| Objective | Success Criteria |
|-----------|-----------------|
| Finalize MVP scope | Written confirmation that 17 modules + 8 sprints is approved |
| Identify deferred features | Clear list of what is NOT in MVP (AI tools, gamification, etc.) |
| Validate user flows | Admin and Member journeys documented |
| Content requirements | Keanu confirms video content will be ready for Sprint 4 |

### 2.2 Technical Objectives

| Objective | Success Criteria |
|-----------|-----------------|
| Stack validation | Next.js 14 + Supabase + Prisma + Mux all working together locally |
| Database schema design | All 15+ tables defined with relationships |
| Auth architecture | Supabase Auth configured, role-based access working |
| API structure | Route conventions established, Zod validation pattern set |
| Video pipeline | Mux upload + webhook flow proven with test video |

### 2.3 Infrastructure Objectives

| Objective | Success Criteria |
|-----------|-----------------|
| Repository setup | GitHub repo with branch protection, PR templates |
| Local development | `pnpm dev` runs full stack (Next.js + Supabase local) |
| Staging environment | Vercel preview deployments working on PRs |
| Production environment | app.legacyscale.co resolves to deployed skeleton |
| Environment variables | All secrets in Vercel env vars, .env.local documented |

### 2.4 UX/UI Objectives

| Objective | Success Criteria |
|-----------|-----------------|
| Design system tokens | Colors, typography, spacing defined in Tailwind config |
| Component library | ShadCN/UI installed, dark theme configured |
| Layout shells | Admin sidebar, User sidebar, TopNav all rendering |
| Responsive baseline | Layouts work on mobile viewport |

### 2.5 Security Objectives

| Objective | Success Criteria |
|-----------|-----------------|
| RLS policy design | Row-Level Security rules documented for all user tables |
| Auth guard pattern | Middleware blocking unauthenticated + wrong-role access |
| Webhook security | Pattern for verifying webhook signatures established |
| Environment handling | No secrets in code, all in env vars |

### 2.6 DevOps Objectives

| Objective | Success Criteria |
|-----------|-----------------|
| CI pipeline | GitHub Actions running lint + type check on PRs |
| CD pipeline | Vercel auto-deploys on merge to main |
| Preview deployments | Every PR gets a preview URL |
| Rollback capability | Can revert to previous Vercel deployment in < 2 mins |

### 2.7 Delivery Process Objectives

| Objective | Success Criteria |
|-----------|-----------------|
| Sprint cadence | Weekly sprints confirmed (40 hrs/week) |
| Communication rhythm | Agreed async update schedule (Slack? Email? Loom?) |
| Acceptance criteria | Each sprint has clear "done" definition |
| Change request process | How new requests are handled documented |

### 2.8 Client Communication Objectives

| Objective | Success Criteria |
|-----------|-----------------|
| Weekly demo | Keanu sees working software every Friday |
| Progress visibility | Keanu can check staging URL anytime |
| Blocker escalation | Process for "I need X from you" requests |
| Content handoff | How Keanu provides video files documented |

### 2.9 QA/Testing Objectives

| Objective | Success Criteria |
|-----------|-----------------|
| Testing strategy | Manual vs automated testing boundaries defined |
| E2E test framework | Playwright configured (even if tests come later) |
| Bug tracking | Where bugs are logged (GitHub Issues?) |
| Regression approach | How to prevent breaking existing features |

---

## 3. MVP Scope Validation

### 3.1 Analysis: What the Documents Say

**From MVP Modules Excel:**
- 17 total modules: 7 Admin + 10 User
- Sprints 1-6 build core features
- Sprint 7 is QA + Security + Launch
- Phase 2 deferred list includes: AI tools, gamification, live events, certificates

**From Sprint Planning Excel:**
- 8 sprints over 8 weeks
- 40 hours/sprint = 320 total hours
- $12/hr = $3,840 total (conflicts with proposal's $12,000 NTE)

**From Proposal PDF:**
- $16/hr rate (not $12)
- 750 hours NTE = $12,000
- 24 weeks timeline (not 8 weeks)
- Includes modules NOT in the Excel: AI Toolkit, Gamification, Event Calendar, Analytics

### 3.2 Critical Scope Discrepancy

**The Excel spreadsheets define a SMALLER MVP than the PDF proposal.**

| Feature | Excel MVP | PDF Proposal |
|---------|-----------|--------------|
| Auth + Member Management | Yes | Yes |
| Course + Chapter + Lesson Management | Yes | Yes |
| Quiz Builder | Yes | Yes |
| Announcements | Yes | Yes |
| Video LMS (Mux) | Yes | Yes |
| Course Player + Progress | Yes | Yes |
| Dashboard + Profile | Yes | Yes |
| GHL Webhook | Yes | Yes |
| **AI Marketing Copy Generator** | **DEFERRED** | **Included** |
| **AI Proposal Builder** | **DEFERRED** | **Included** |
| **AI Coaching Agent** | **DEFERRED** | **Included** |
| **Gamification (Points/Badges)** | **DEFERRED** | **Included** |
| **Live Event Calendar** | **DEFERRED** | **Included** |
| **Google Calendar OAuth** | **DEFERRED** | **Included** |
| **Admin BI Analytics** | **DEFERRED** | **Included** |
| **Certificates** | **DEFERRED** | **Included** |

### 3.3 Recommendation: Adopt the Excel MVP Scope

**The Excel spreadsheet defines the TRUE MVP.** The PDF proposal scope is Phase 1 + Phase 2 combined.

**Rationale:**
1. **Budget alignment**: 320 hours at $12-16/hr = $3,840-$5,120. The $12,000 budget allows for Phase 2 features.
2. **Risk reduction**: AI tools are high-complexity, high-cost (Claude API). Validate LMS retention first.
3. **Speed to market**: 8 weeks to live platform vs 24 weeks.
4. **Revenue earlier**: Keanu can start charging members in 8 weeks, not 24.

### 3.4 Core MUST-HAVE Features (Excel MVP)

| Module | Side | Sprint | Rationale |
|--------|------|--------|-----------|
| Auth (Login/Password Reset) | User | 1 | Nothing works without login |
| Member Management | Admin | 1 | Admin must create/control member access |
| GHL Webhook Handler | Admin | 1 | Automated member activation from payments |
| Course Management | Admin | 2 | Core product = courses |
| Chapter Management | Admin | 2 | Courses need structure |
| Lesson Management | Admin | 2 | Content delivery vehicle |
| Quiz Builder | Admin | 3 | Engagement + learning validation |
| Announcements | Admin | 3 | Communication channel |
| Course Library | User | 4 | Members browse courses |
| Course Player | User | 4 | Members watch videos |
| Progress Tracking | User | 4 | Core retention mechanic |
| Quiz Player | User | 5 | Complete quiz experience |
| Resource Lessons | User | 5 | Downloadable content |
| Lesson Notes | User | 5 | Personal learning aid |
| Announcements Feed | User | 5 | Read admin announcements |
| Dashboard | User | 6 | Member home page |
| Profile | User | 6 | Member settings |

### 3.5 Features That Should Be Postponed (Confirmed)

These are already marked "Deferred to Phase 2" in the Excel:

| Feature | Reason to Defer | Build When |
|---------|-----------------|------------|
| AI Marketing Copy Generator | High complexity, needs content foundation | After members retained on content |
| AI Proposal Builder | High complexity, validate LMS first | After MVP stable |
| AI Coaching Agent | Most expensive to operate | After product-market fit |
| Gamification | Validate organic retention first | When member base is large enough |
| Live Event Calendar | Zoom + manual links work for MVP | When events are primary retention driver |
| Google Calendar OAuth | Complex bidirectional sync not needed | When Event Calendar is built |
| Admin BI Analytics Dashboard | No data to analyze at MVP scale | When reporting needed for decisions |
| Email Notification Preferences | One welcome email is enough | When automated comms needed |
| Certificates | Nice-to-have, not blocking | Early Phase 2 |
| Course Search | Few courses, browse list sufficient | When 10+ courses |
| Mobile App | Web-first is enough | When 40%+ mobile usage |

### 3.6 High-Risk Modules

| Module | Risk | Mitigation |
|--------|------|------------|
| Mux Video Integration | Webhook reliability, upload failures | Build proof-of-concept in Phase 0, add retry logic |
| GHL Webhook Handler | Undocumented payload structure | Get sample payloads from Keanu before Sprint 1 |
| Quiz Builder | Complex state management for drag-drop | Use proven library (dnd-kit), simplify to ordered list if needed |
| Row-Level Security | Misconfiguration exposes user data | RLS audit before every deploy, test as different users |

### 3.7 Hidden Complexity

| Area | Complexity Hidden |
|------|-------------------|
| Video Progress Tracking | "Mark complete on video end" requires Mux player event handling, race conditions with manual complete button |
| Lesson Notes Auto-Save | Debounce logic, conflict resolution if user has multiple tabs, offline handling |
| Quiz Attempt Logging | Schema for storing arbitrary answers, replay capability, score calculation |
| Announcement Unread Badge | Requires tracking last-read timestamp per user, real-time update consideration |
| Course Enrollment | Auto-enroll on first lesson click has edge cases: what if they click quiz first? What if they're already enrolled? |

### 3.8 Technical Unknowns

| Unknown | Impact | Resolution Approach |
|---------|--------|---------------------|
| GHL Webhook Payload Structure | Can't build handler without knowing fields | Get sample payload from Keanu in Phase 0 |
| Mux Webhook Timing | How long until video.asset.ready fires? | Test with real upload in Phase 0 |
| Supabase Storage Limits | File size limits for resources? | Check plan limits, may need upgrade |
| Vercel Serverless Timeout | Long video uploads may timeout | Use client-side direct upload to Mux |

### 3.9 Dependencies

| Dependency | Owner | Required By |
|------------|-------|-------------|
| Mux Account + API Keys | Developer | Sprint 0 |
| Supabase Project | Developer | Sprint 0 |
| Vercel Account | Developer | Sprint 0 |
| Resend Account + Domain Verification | Developer + Keanu (DNS) | Sprint 1 |
| GHL Webhook Sample Payload | Keanu | Sprint 1 |
| Video Content Files | Keanu | Sprint 4 |
| Custom Domain DNS | Keanu | Sprint 7 |
| Production Supabase Project | Developer | Sprint 7 |

### 3.10 Scope Creep Risks

| Risk | Trigger | Prevention |
|------|---------|------------|
| "Can we add badges?" | Gamification seems simple | Point to Phase 2 list, estimate hours |
| "Members need notifications" | Announcement badge leads to email/push | One welcome email only for MVP |
| "Need search for courses" | Seems easy but affects performance | With <10 courses, browse is fine |
| "Admin needs analytics" | Keanu wants to see metrics | Manual Supabase queries for MVP |
| "Mobile app?" | Members ask for app | PWA later, web-first now |

### 3.11 Recommended TRUE MVP Scope

**Build exactly what the Excel spreadsheet defines:**
- 17 modules (7 Admin, 10 User)
- 8 sprints over 8 weeks
- 320 hours at $12-16/hr

**What should be removed from original proposal:** AI Toolkit (3 tools), Gamification, Event Calendar, Google Cal OAuth, Admin BI Dashboard, Certificates, Course Search.

**What should be mocked/faked initially:**
- Email templates: Plain text for MVP, React Email polish in Phase 2
- Admin analytics: Direct Supabase dashboard queries, no custom BI

**What can be manual during MVP:**
- Member creation if GHL webhook fails: Admin creates manually
- Video uploads: Keanu uploads via admin panel, no bulk import
- Announcements: No scheduling, publish immediately only
- Course ordering: Manual order_index, no drag-drop if time-crunched

---

## 4. Technical Architecture Planning

### 4.1 Proposed Final Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                  │
├─────────────────────────────────────────────────────────────────┤
│  Web Browser (Desktop + Mobile)                                  │
│  └── Next.js 14 App Router (React Server Components)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         HOSTING                                  │
├─────────────────────────────────────────────────────────────────┤
│  Vercel                                                          │
│  ├── Edge Network (CDN)                                         │
│  ├── Serverless Functions (API Routes)                          │
│  └── Preview Deployments (PR branches)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
├─────────────────────────────────────────────────────────────────┤
│  Next.js API Routes (/api/*)                                    │
│  ├── Zod validation on all inputs                               │
│  ├── Supabase Auth JWT verification                             │
│  └── Prisma ORM for database access                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│  Supabase                                                        │
│  ├── PostgreSQL Database (Prisma-managed schema)                │
│  ├── Auth (Email/Password, Password Reset)                      │
│  ├── Storage (Avatars, Resource Files)                          │
│  └── Row-Level Security (User data isolation)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
├─────────────────────────────────────────────────────────────────┤
│  Mux          - Video hosting, streaming, webhooks              │
│  Resend       - Transactional email (welcome, password reset)   │
│  GoHighLevel  - Payment webhooks (member activation)            │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Backend Structure

**API Route Organization:**
```
/app/api/
├── auth/
│   └── [...supabase]/route.ts    # Supabase auth callback
├── webhooks/
│   ├── ghl/route.ts              # GoHighLevel payment webhook
│   └── mux/route.ts              # Mux video ready webhook
├── admin/
│   ├── members/route.ts          # CRUD members
│   ├── courses/route.ts          # CRUD courses
│   ├── courses/[id]/
│   │   ├── chapters/route.ts     # CRUD chapters
│   │   └── chapters/[chapterId]/
│   │       └── lessons/route.ts  # CRUD lessons
│   ├── lessons/[id]/
│   │   └── quiz/route.ts         # CRUD quiz questions
│   └── announcements/route.ts    # CRUD announcements
├── courses/
│   ├── route.ts                  # List published courses
│   └── [slug]/route.ts           # Course detail with progress
├── lessons/
│   └── [id]/
│       ├── quiz/route.ts         # Fetch quiz questions
│       ├── quiz/submit/route.ts  # Submit quiz attempt
│       └── resource/route.ts     # Signed download URL
├── progress/
│   └── [lessonId]/
│       └── complete/route.ts     # Mark lesson complete
├── notes/
│   └── [lessonId]/route.ts       # GET/UPSERT lesson notes
├── dashboard/route.ts            # Dashboard aggregation
├── announcements/route.ts        # List announcements for user
└── mux/
    └── upload/route.ts           # Create Mux upload URL
```

**Route Pattern:**
- All routes validate input with Zod
- All routes verify Supabase session
- Admin routes check `user.role === 'ADMIN'`
- User routes scope queries by `user.id`

### 4.3 Frontend Structure

**App Router Organization:**
```
/app/
├── (auth)/
│   ├── login/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
├── (admin)/
│   ├── layout.tsx                # Admin sidebar layout
│   ├── admin/
│   │   ├── members/page.tsx
│   │   ├── members/[id]/page.tsx
│   │   ├── courses/page.tsx
│   │   ├── courses/new/page.tsx
│   │   ├── courses/[id]/page.tsx
│   │   ├── courses/[id]/chapters/[chapterId]/page.tsx
│   │   ├── lessons/[id]/quiz/page.tsx
│   │   └── announcements/page.tsx
├── (user)/
│   ├── layout.tsx                # User sidebar layout
│   ├── dashboard/page.tsx
│   ├── courses/page.tsx
│   ├── courses/[slug]/page.tsx
│   ├── courses/[slug]/lessons/[id]/page.tsx
│   ├── announcements/page.tsx
│   └── profile/page.tsx
├── layout.tsx                    # Root layout
├── page.tsx                      # Redirect to /login or /dashboard
└── not-found.tsx                 # 404 page
```

### 4.4 Database Design Strategy

**Approach: Prisma Schema-First**
1. Define all tables in `schema.prisma`
2. Run `prisma db push` to sync with Supabase
3. RLS policies added directly in Supabase dashboard
4. Migrations via `prisma migrate` for production changes

**Core Tables (see Section 6 for full schema):**
- `users` - Member/Admin profiles
- `courses`, `chapters`, `lessons` - Content hierarchy
- `enrollments`, `lesson_progress` - User progress
- `quiz_questions`, `quiz_attempts` - Quiz system
- `notes` - Personal lesson notes
- `announcements` - Admin broadcasts
- `files` - Resource file metadata

### 4.5 Auth Approach

**Provider: Supabase Auth**
- Email/password authentication
- Built-in password reset flow
- JWT tokens for session management
- No social login for MVP (simplicity)

**Role System:**
- Two roles only: `ADMIN` and `MEMBER`
- Role stored in `users.role` column
- Middleware checks role for route protection
- RLS policies enforce data isolation

**Session Handling:**
```typescript
// Server Component
import { createServerClient } from '@supabase/ssr'

// Get session in Server Component
const supabase = createServerClient(...)
const { data: { user } } = await supabase.auth.getUser()

// Middleware protection
if (!user) redirect('/login')
if (pathname.startsWith('/admin') && user.role !== 'ADMIN') {
  redirect('/dashboard')
}
```

### 4.6 File Storage Strategy

**Provider: Supabase Storage**

| Bucket | Content | Access |
|--------|---------|--------|
| `avatars` | User profile photos | Public (CDN-cached) |
| `thumbnails` | Course thumbnails | Public (CDN-cached) |
| `resources` | Lesson downloadable files | Private (signed URLs) |

**Upload Pattern:**
1. Client requests presigned upload URL from API
2. Client uploads directly to Supabase Storage
3. API receives file metadata, creates database record
4. For downloads: API generates short-lived signed URL

### 4.7 API Architecture

**Pattern: Next.js Route Handlers with Zod**

```typescript
// /app/api/admin/courses/route.ts
import { z } from 'zod'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

const CreateCourseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
})

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.role !== 'ADMIN') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = CreateCourseSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 })
  }

  const course = await prisma.course.create({
    data: { ...parsed.data, status: 'DRAFT' }
  })

  return Response.json(course, { status: 201 })
}
```

### 4.8 State Management

**Approach: Server-First with Minimal Client State**

- **Server Components** for data fetching (no client-side state for fetched data)
- **React Hook Form + Zod** for form state
- **URL state** for filters, pagination, active lesson
- **Zustand** only if cross-component state needed (unlikely for MVP)

### 4.9 Deployment Architecture

```
GitHub Repository
       │
       ▼
┌──────────────┐
│ GitHub Push  │
└──────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│              Vercel                           │
├──────────────────────────────────────────────┤
│  PR Branch → Preview Deployment              │
│  main Branch → Production Deployment         │
│                                              │
│  Environment Variables:                      │
│  - NEXT_PUBLIC_SUPABASE_URL                 │
│  - NEXT_PUBLIC_SUPABASE_ANON_KEY            │
│  - SUPABASE_SERVICE_ROLE_KEY                │
│  - MUX_TOKEN_ID                             │
│  - MUX_TOKEN_SECRET                         │
│  - MUX_WEBHOOK_SECRET                       │
│  - RESEND_API_KEY                           │
│  - GHL_WEBHOOK_SECRET                       │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│           Supabase Project                    │
├──────────────────────────────────────────────┤
│  - PostgreSQL Database                       │
│  - Auth Service                              │
│  - Storage Buckets                           │
│  - RLS Policies                              │
└──────────────────────────────────────────────┘
```

### 4.10 Scaling Considerations

**MVP Scale (0-500 members):**
- Vercel free/hobby tier sufficient
- Supabase free tier sufficient (500MB database)
- Mux pay-as-you-go pricing

**Growth Scale (500-5000 members):**
- Vercel Pro for more serverless execution
- Supabase Pro for 8GB database + better performance
- Consider edge caching for course listings

**Not Needed for MVP:**
- Redis caching
- Background job queues
- Microservices
- CDN for video (Mux handles this)

### 4.11 Recommended Stack

| Layer | Technology | Why |
|-------|------------|-----|
| Framework | Next.js 14 (App Router) | Best DX, React Server Components, Vercel integration |
| Language | TypeScript | Type safety essential for solo dev maintenance |
| Styling | Tailwind CSS | Fastest styling, dark mode support |
| Components | ShadCN/UI | Customizable, accessible, Tailwind-native |
| Database | Supabase (PostgreSQL) | Auth + DB + Storage in one, generous free tier |
| ORM | Prisma | Type-safe queries, schema management |
| Video | Mux | Purpose-built for video LMS, adaptive streaming |
| Email | Resend | Modern API, React Email templates |
| Hosting | Vercel | Zero-config Next.js deployment |
| Forms | React Hook Form + Zod | Best performance, validation reuse |

### 4.12 Alternatives Considered

| Decision | Alternative | Why Not |
|----------|-------------|---------|
| Supabase | Firebase | PostgreSQL > NoSQL for relational data, RLS is powerful |
| Supabase | AWS (RDS + Cognito + S3) | Too much infrastructure management for solo dev |
| Mux | Cloudflare Stream | Mux has better LMS features (chapters, thumbnails) |
| Mux | Self-hosted (S3 + HLS) | Massive complexity, no adaptive streaming |
| Vercel | AWS Amplify | Vercel's Next.js integration is unmatched |
| Vercel | Railway/Render | More config, less Next.js optimization |
| Prisma | Drizzle | Prisma's Supabase integration is mature |
| ShadCN | Radix + custom | ShadCN is Radix with styling done |

### 4.13 Stack Tradeoffs

**Chosen Stack Strengths:**
- Fastest path to production for solo dev
- All services have generous free tiers
- Strong TypeScript support throughout
- Minimal ops burden (no servers to manage)

**Chosen Stack Weaknesses:**
- Vendor lock-in to Vercel/Supabase
- Supabase RLS adds complexity to queries
- No real-time features without additional work
- Serverless cold starts on low-traffic routes

---

## 5. Infrastructure & DevOps Setup

### 5.1 Repository Setup

**GitHub Repository Configuration:**
```
Repository: legacyscale/platform (or client's GitHub)
├── Branch protection on main:
│   ├── Require PR reviews (optional for solo dev)
│   ├── Require status checks (lint, type-check)
│   └── No direct push to main
├── PR template: .github/pull_request_template.md
├── Issue templates: .github/ISSUE_TEMPLATE/
└── GitHub Actions: .github/workflows/
```

**Recommended Branch Strategy (Solo Dev):**
```
main          ← Production (auto-deploys)
  └── feature/sprint-1-auth
  └── feature/sprint-2-courses
  └── fix/video-upload-bug
```

Simple feature branch → PR → merge. No develop branch needed for solo dev.

### 5.2 Branching Strategy

**Simplified Git Flow:**
1. Create feature branch from `main`
2. Develop + commit locally
3. Push branch, create PR
4. Vercel creates preview deployment
5. Self-review or Keanu reviews
6. Merge to main → auto-deploy to production

**Branch Naming:**
- `feature/sprint-X-description` - New features
- `fix/description` - Bug fixes
- `chore/description` - Dependencies, config

### 5.3 Environments

| Environment | URL | Trigger | Database |
|-------------|-----|---------|----------|
| Local | localhost:3000 | `pnpm dev` | Supabase local (Docker) |
| Preview | random-url.vercel.app | PR push | Staging Supabase |
| Production | app.legacyscale.co | Merge to main | Production Supabase |

### 5.4 CI/CD Pipeline

**GitHub Actions Workflow:**
```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  lint-and-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm build
```

**Vercel Auto-Deploy:**
- Preview: Every PR gets unique URL
- Production: Merge to main auto-deploys

### 5.5 Staging Environment

**Staging = Preview Deployments**

For solo dev, separate staging environment is overkill. Use Vercel preview deployments:
- Every PR branch gets a deployment
- Test features before merging
- Share preview URL with Keanu for approval

### 5.6 Production Environment

**Vercel Production:**
- Custom domain: app.legacyscale.co
- Environment variables configured
- Automatic SSL via Vercel

**Supabase Production:**
- Separate project from development
- Same schema, different data
- Production API keys

### 5.7 Backups

**Supabase Automated Backups:**
- Free tier: Daily backups, 7-day retention (Pro)
- Point-in-time recovery on Pro plan

**Manual Backup Strategy:**
- `pg_dump` before major migrations
- Export critical data before destructive operations

### 5.8 Logging

**Vercel Logs:**
- Function logs in Vercel dashboard
- Request/response logging built-in
- Real-time log streaming

**Application Logging:**
```typescript
// Simple console logging, appears in Vercel logs
console.log('[Webhook] GHL payment received', { email, amount })
console.error('[Error] Video upload failed', { lessonId, error })
```

### 5.9 Monitoring

**Free Tier Monitoring:**
- Vercel Analytics (traffic, performance)
- Supabase Dashboard (database stats)
- Mux Dashboard (video analytics)

**Recommended Addition:**
- Sentry free tier for error tracking (optional for MVP)
- Uptime Robot free tier for uptime monitoring

### 5.10 Analytics

**MVP Analytics:**
- Vercel Web Analytics (page views, visitors)
- Supabase: Direct SQL queries for business metrics

**Post-MVP:**
- PostHog (free tier) for product analytics
- Custom admin dashboard with Recharts

### 5.11 Error Tracking

**MVP Approach:**
- Console.error + Vercel logs
- Manual monitoring during active development

**Recommended Addition:**
- Sentry free tier: 5,000 errors/month
- Install `@sentry/nextjs` package

### 5.12 Uptime Monitoring

**Free Options:**
- Uptime Robot: 50 monitors free
- Better Uptime: 10 monitors free
- Vercel Status: Built-in for Vercel infra

**Setup:**
- Monitor app.legacyscale.co
- Monitor /api/health endpoint
- Email alert on downtime

### 5.13 Secrets Management

**Vercel Environment Variables:**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx (server-only)
DATABASE_URL=postgres://... (for Prisma)

MUX_TOKEN_ID=xxx
MUX_TOKEN_SECRET=xxx
MUX_WEBHOOK_SECRET=xxx

RESEND_API_KEY=xxx

GHL_WEBHOOK_SECRET=xxx
```

**Rules:**
- Never commit secrets to git
- Use `.env.local` for local development
- Document required env vars in `.env.example`
- `NEXT_PUBLIC_` prefix for client-accessible vars

### 5.14 Recommended DevOps Tools

| Tool | Purpose | Cost |
|------|---------|------|
| GitHub | Repository, CI/CD | Free |
| Vercel | Hosting, Preview, CDN | Free/Hobby |
| Supabase | Database, Auth, Storage | Free tier |
| Mux | Video hosting | Pay-as-you-go |
| Resend | Transactional email | Free tier (100/day) |
| Uptime Robot | Uptime monitoring | Free (50 monitors) |
| Sentry | Error tracking | Free (5K errors/mo) |

**Total MVP Infra Cost: $0-20/month** (depends on video storage)

---

## 6. Database & Data Planning

### 6.1 Initial Schema Planning Strategy

**Approach: Design all tables upfront, iterate as needed**

Benefits:
- See full data model before coding
- Identify relationship issues early
- RLS policies planned from start

### 6.2 Complete Prisma Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// USER MANAGEMENT
// ============================================

enum Role {
  ADMIN
  MEMBER
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String?
  avatarUrl     String?
  role          Role      @default(MEMBER)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  enrollments     Enrollment[]
  lessonProgress  LessonProgress[]
  quizAttempts    QuizAttempt[]
  notes           Note[]
}

// ============================================
// COURSE STRUCTURE
// ============================================

enum CourseStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model Course {
  id            String        @id @default(uuid())
  title         String
  description   String?
  thumbnailUrl  String?
  status        CourseStatus  @default(DRAFT)
  orderIndex    Int           @default(0)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  // Relations
  chapters      Chapter[]
  enrollments   Enrollment[]
}

model Chapter {
  id          String    @id @default(uuid())
  courseId    String
  title       String
  orderIndex  Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  course      Course    @relation(fields: [courseId], references: [id], onDelete: Cascade)
  lessons     Lesson[]
}

enum LessonType {
  VIDEO
  QUIZ
  RESOURCE
}

enum LessonStatus {
  DRAFT
  PROCESSING  // Video uploading/encoding
  READY
}

model Lesson {
  id              String        @id @default(uuid())
  chapterId       String
  title           String
  type            LessonType
  status          LessonStatus  @default(DRAFT)
  orderIndex      Int           @default(0)

  // Video fields (type = VIDEO)
  muxAssetId      String?
  muxPlaybackId   String?
  durationSeconds Int?

  // Resource fields (type = RESOURCE)
  resourceUrl     String?
  resourceName    String?
  resourceSize    Int?

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  // Relations
  chapter         Chapter       @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  quizQuestions   QuizQuestion[]
  lessonProgress  LessonProgress[]
  quizAttempts    QuizAttempt[]
  notes           Note[]
}

// ============================================
// QUIZ SYSTEM
// ============================================

enum QuestionType {
  MULTIPLE_CHOICE
  TRUE_FALSE
}

model QuizQuestion {
  id            String        @id @default(uuid())
  lessonId      String
  questionText  String
  type          QuestionType
  options       Json          // ["Option A", "Option B", ...] or ["True", "False"]
  correctIndex  Int           // Index of correct option
  orderIndex    Int           @default(0)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  // Relations
  lesson        Lesson        @relation(fields: [lessonId], references: [id], onDelete: Cascade)
}

model QuizAttempt {
  id          String    @id @default(uuid())
  userId      String
  lessonId    String
  score       Int       // Number correct
  total       Int       // Total questions
  answers     Json      // { questionId: selectedIndex, ... }
  createdAt   DateTime  @default(now())

  // Relations
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson      Lesson    @relation(fields: [lessonId], references: [id], onDelete: Cascade)
}

// ============================================
// USER PROGRESS
// ============================================

model Enrollment {
  id          String    @id @default(uuid())
  userId      String
  courseId    String
  enrolledAt  DateTime  @default(now())
  completedAt DateTime?

  // Relations
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  course      Course    @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([userId, courseId])
}

model LessonProgress {
  id          String    @id @default(uuid())
  userId      String
  lessonId    String
  completed   Boolean   @default(false)
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson      Lesson    @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([userId, lessonId])
}

// ============================================
// LESSON NOTES
// ============================================

model Note {
  id        String    @id @default(uuid())
  userId    String
  lessonId  String
  content   String    @default("")
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  // Relations
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  lesson    Lesson    @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([userId, lessonId])
}

// ============================================
// ANNOUNCEMENTS
// ============================================

enum AnnouncementStatus {
  DRAFT
  PUBLISHED
}

model Announcement {
  id          String              @id @default(uuid())
  title       String
  body        String
  status      AnnouncementStatus  @default(DRAFT)
  publishedAt DateTime?
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
}
```

### 6.3 Migration Strategy

**Development:**
```bash
# Push schema changes directly (fast iteration)
pnpm prisma db push

# Generate client after schema changes
pnpm prisma generate
```

**Production:**
```bash
# Create migration file
pnpm prisma migrate dev --name add_user_avatar

# Apply to production
pnpm prisma migrate deploy
```

**Rules:**
- Always backwards-compatible migrations
- No data-destroying changes without explicit backup
- Test migrations on staging first

### 6.4 Seed Strategy

**Development Seed Script:**
```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@legacyscale.co' },
    update: {},
    create: {
      email: 'admin@legacyscale.co',
      name: 'Keanu Vasquez',
      role: 'ADMIN',
      isActive: true,
    },
  })

  // Create sample course
  const course = await prisma.course.create({
    data: {
      title: '7-Figure Agency Program',
      description: 'The complete training curriculum',
      status: 'PUBLISHED',
      chapters: {
        create: [
          {
            title: 'Getting Started',
            orderIndex: 0,
            lessons: {
              create: [
                {
                  title: 'Welcome to the Program',
                  type: 'VIDEO',
                  status: 'READY',
                  orderIndex: 0,
                  muxPlaybackId: 'test-playback-id', // Replace with real
                },
                {
                  title: 'Module 1 Quiz',
                  type: 'QUIZ',
                  status: 'READY',
                  orderIndex: 1,
                },
              ],
            },
          },
        ],
      },
    },
  })

  // Create sample announcement
  await prisma.announcement.create({
    data: {
      title: 'Welcome to Legacy Scale!',
      body: 'We are excited to have you here...',
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  })

  console.log('Seed complete')
}

main()
```

### 6.5 Backup Strategy

| Environment | Backup Method | Frequency | Retention |
|-------------|--------------|-----------|-----------|
| Development | None (seed script recreates) | N/A | N/A |
| Production | Supabase automated | Daily | 7 days (Pro) |
| Pre-migration | Manual `pg_dump` | Before each migration | Keep forever |

**Pre-Migration Backup Command:**
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 6.6 Indexing Considerations

**Indexes to Add:**
```sql
-- User lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Course queries
CREATE INDEX idx_courses_status ON courses(status);
CREATE INDEX idx_chapters_course_id ON chapters(course_id);
CREATE INDEX idx_lessons_chapter_id ON lessons(chapter_id);

-- Progress tracking
CREATE INDEX idx_lesson_progress_user_id ON lesson_progress(user_id);
CREATE INDEX idx_enrollments_user_id ON enrollments(user_id);

-- Announcements
CREATE INDEX idx_announcements_status ON announcements(status);
CREATE INDEX idx_announcements_published_at ON announcements(published_at);
```

Prisma will create indexes for `@unique` and relation fields automatically.

### 6.7 Performance Considerations

**Potential Bottlenecks:**
| Query | Issue | Solution |
|-------|-------|----------|
| Dashboard aggregation | Multiple queries for progress | Single optimized query with joins |
| Course with all lessons | N+1 query risk | Prisma `include` with nested relations |
| Quiz questions fetch | Could leak correct answers | Separate endpoint, exclude `correctIndex` |

**Query Optimization:**
```typescript
// Good: Single query with includes
const course = await prisma.course.findUnique({
  where: { id },
  include: {
    chapters: {
      orderBy: { orderIndex: 'asc' },
      include: {
        lessons: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    },
  },
})

// Bad: Multiple queries
const course = await prisma.course.findUnique({ where: { id } })
const chapters = await prisma.chapter.findMany({ where: { courseId: id } })
// ... more queries for each chapter's lessons
```

### 6.8 Risky Database Relationships

| Relationship | Risk | Mitigation |
|--------------|------|------------|
| User → LessonProgress | High volume, per-user-per-lesson | Index on (userId, lessonId), unique constraint |
| Course → Chapters → Lessons | Deep nesting | Limit to 3 levels, single query with includes |
| Lesson → QuizQuestions | Order matters | orderIndex column, careful reorder logic |
| Cascade deletes | Delete course = delete everything | Explicit confirmation UI, soft delete option |

### 6.9 Scalability Bottlenecks

**At 500+ Members:**
- `lesson_progress` table grows fast (users × lessons)
- Dashboard aggregation may slow down

**Solutions (apply when needed):**
- Materialized progress view refreshed periodically
- Cache dashboard data in Redis (overkill for MVP)
- Pagination on course library

**At 10,000+ Members:**
- Consider read replicas
- Move analytics queries off primary
- This is a good problem to have

### 6.10 Future Migration Risks

| Future Feature | Schema Impact | Preparation |
|----------------|--------------|-------------|
| Gamification (points) | New tables: user_points, badges | No prep needed, additive |
| AI Tools | New tables: ai_sessions, ai_usage | No prep needed, additive |
| Multiple subscription tiers | Add tier column to users or subscriptions table | Leave room for subscription table |
| Course prerequisites | Add prerequisite_id to courses | Current schema supports this |

---

## 7. UI/UX Foundation

### 7.1 Design System

**Design Direction:** Premium, dark-mode-first, agency aesthetic

Reference: adlevel.ai style (mentioned in proposal)
- Clean, modern interface
- Dark backgrounds with subtle gradients
- Accent colors for CTAs and progress
- Generous whitespace
- Sharp, confident typography

### 7.2 Component Strategy

**ShadCN/UI as Foundation:**
```bash
# Install ShadCN
pnpm dlx shadcn-ui@latest init

# Add core components
pnpm dlx shadcn-ui@latest add button card input label
pnpm dlx shadcn-ui@latest add dialog dropdown-menu toast
pnpm dlx shadcn-ui@latest add table tabs avatar badge
pnpm dlx shadcn-ui@latest add form select checkbox radio-group
pnpm dlx shadcn-ui@latest add skeleton progress separator
```

**Custom Components to Build:**
| Component | Purpose |
|-----------|---------|
| `Sidebar` | Admin/User navigation |
| `CourseCard` | Course grid items |
| `LessonItem` | Sidebar lesson with status |
| `VideoPlayer` | Mux player wrapper |
| `QuizModal` | Quiz overlay |
| `EmptyState` | No data placeholders |

### 7.3 Typography

**Tailwind Typography Config:**
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display': ['3.5rem', { lineHeight: '1.1', fontWeight: '700' }],
        'h1': ['2.25rem', { lineHeight: '1.2', fontWeight: '700' }],
        'h2': ['1.875rem', { lineHeight: '1.3', fontWeight: '600' }],
        'h3': ['1.5rem', { lineHeight: '1.4', fontWeight: '600' }],
        'h4': ['1.25rem', { lineHeight: '1.5', fontWeight: '600' }],
        'body': ['1rem', { lineHeight: '1.6' }],
        'small': ['0.875rem', { lineHeight: '1.5' }],
        'tiny': ['0.75rem', { lineHeight: '1.4' }],
      },
    },
  },
}
```

### 7.4 Spacing System

**8px Grid System:**
```javascript
// tailwind.config.js - spacing already follows 4px base
// Use: p-2 (8px), p-4 (16px), p-6 (24px), p-8 (32px)

spacing: {
  'page': '2rem',      // Page padding
  'section': '3rem',   // Between sections
  'card': '1.5rem',    // Card internal padding
  'input': '0.75rem',  // Input padding
}
```

### 7.5 Color System

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Brand colors (adjust to Keanu's brand)
        brand: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          500: '#6366f1',  // Primary
          600: '#4f46e5',  // Primary hover
          700: '#4338ca',
        },
        // Semantic colors
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        // Dark theme backgrounds
        background: {
          DEFAULT: '#0a0a0a',
          card: '#141414',
          elevated: '#1f1f1f',
        },
        // Text colors
        foreground: {
          DEFAULT: '#fafafa',
          muted: '#a1a1aa',
          subtle: '#71717a',
        },
      },
    },
  },
}
```

### 7.6 Responsive Strategy

**Breakpoints (Tailwind defaults):**
- `sm`: 640px (large phones)
- `md`: 768px (tablets)
- `lg`: 1024px (laptops)
- `xl`: 1280px (desktops)

**Mobile-First Approach:**
```tsx
// Default = mobile, then scale up
<div className="
  px-4 md:px-6 lg:px-8          // Padding scales up
  grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3  // Columns scale up
">
```

**Key Responsive Behaviors:**
| Element | Mobile | Desktop |
|---------|--------|---------|
| Sidebar | Hidden, hamburger menu | Fixed left |
| Course grid | 1 column | 2-3 columns |
| Course player | Stacked (sidebar → video) | Split (sidebar | video) |
| Tables | Horizontal scroll | Full width |
| Quiz modal | Full screen | Centered overlay |

### 7.7 Accessibility Baseline

**WCAG 2.1 AA Minimum:**
- Color contrast 4.5:1 for normal text
- Focus indicators on all interactive elements
- Keyboard navigation for all features
- Alt text for images
- Form labels associated with inputs

**Implementation:**
```tsx
// ShadCN components handle most a11y
// Ensure:
<Button>Click me</Button>  // Has focus ring
<Input aria-label="Email" />  // If no visible label
<img alt="Course thumbnail" />  // All images
```

### 7.8 Interaction Patterns

| Interaction | Pattern |
|-------------|---------|
| Form submission | Button shows loading spinner, disables, success toast |
| Delete action | Confirmation dialog before action |
| List reorder | Drag handle, visual feedback during drag |
| Video complete | Auto-advance option, completion checkmark |
| Quiz submit | Inline result display, color-coded answers |

### 7.9 Dashboard Structure

```
┌─────────────────────────────────────────────────────────────┐
│  TopNav: Logo │ Search (future) │ Avatar + Name │ Logout   │
├─────────────────────────────────────────────────────────────┤
│        │                                                    │
│  Side  │   Welcome back, [Name]!                           │
│  bar   │                                                    │
│        │   ┌─────────────────────────────────┐              │
│  Home  │   │  Continue Watching              │              │
│  Courses│   │  [Course Card] Progress: 45%   │              │
│  Announce│   │  [Continue Button]             │              │
│  Profile│   └─────────────────────────────────┘              │
│        │                                                    │
│        │   Your Courses                                     │
│        │   ┌────────┐ ┌────────┐ ┌────────┐                │
│        │   │Course 1│ │Course 2│ │Course 3│                │
│        │   │ 45%    │ │ 100%   │ │ 0%     │                │
│        │   └────────┘ └────────┘ └────────┘                │
│        │                                                    │
│        │   Latest Announcements                             │
│        │   • Announcement 1...                              │
│        │   • Announcement 2...                              │
│        │   [View all →]                                     │
└─────────────────────────────────────────────────────────────┘
```

### 7.10 Loading States

**Skeleton Patterns:**
```tsx
// Course card skeleton
<div className="animate-pulse">
  <div className="bg-gray-700 h-40 rounded-lg" />  // Thumbnail
  <div className="mt-4 h-4 bg-gray-700 rounded w-3/4" />  // Title
  <div className="mt-2 h-3 bg-gray-700 rounded w-1/2" />  // Progress
</div>

// Table row skeleton
<tr className="animate-pulse">
  <td><div className="h-4 bg-gray-700 rounded" /></td>
  <td><div className="h-4 bg-gray-700 rounded" /></td>
  <td><div className="h-4 bg-gray-700 rounded" /></td>
</tr>
```

**Full Page Loading:**
- Use Next.js `loading.tsx` files
- Show skeleton that matches final layout

### 7.11 Empty States

**Pattern:**
```tsx
<EmptyState
  icon={<BookIcon />}
  title="No courses yet"
  description="Courses will appear here once you're enrolled."
  action={<Button>Browse Courses</Button>}
/>
```

**Required Empty States:**
- No courses enrolled
- No announcements
- No notes for lesson
- No quiz questions (admin)
- No members (admin)

### 7.12 Error Handling UX

**Inline Form Errors:**
```tsx
<FormField
  name="email"
  error="Please enter a valid email address"
/>
```

**Toast Notifications:**
```tsx
// Success
toast.success('Course created successfully')

// Error
toast.error('Failed to save. Please try again.')

// With action
toast.error('Session expired', {
  action: { label: 'Log in', onClick: () => router.push('/login') }
})
```

**Page-Level Errors:**
```tsx
// error.tsx in route folder
'use client'

export default function Error({ error, reset }) {
  return (
    <div className="text-center py-20">
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
```

### 7.13 Adapting adlevel.ai Style for MVP Speed

**What to Adopt:**
- Dark theme as default
- Clean card-based layouts
- Subtle hover effects
- Modern sans-serif typography
- Generous whitespace

**What to Simplify for MVP:**
- Skip complex animations (add in polish phase)
- Use solid colors instead of gradients
- Standard ShadCN components instead of custom
- Skip illustration-heavy empty states

**Time-Saving Approach:**
1. Configure Tailwind dark theme
2. Install ShadCN with dark mode
3. Set brand colors in config
4. Use default ShadCN styling
5. Polish later if time permits

---

## 8. Security & Compliance Preparation

### 8.1 Authentication Security

**Supabase Auth Handles:**
- Password hashing (bcrypt)
- Session management (JWT)
- Password reset flow
- Rate limiting on auth endpoints

**Developer Responsibilities:**
- Enable email confirmation (optional for MVP)
- Configure password requirements
- Handle auth errors gracefully
- Clear sessions on logout

### 8.2 Authorization

**Role-Based Access Control:**
```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const supabase = createMiddlewareClient({ req: request, res })
  const { data: { session } } = await supabase.auth.getSession()

  // Redirect unauthenticated users
  if (!session && !isPublicRoute(request.pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Block members from admin routes
  if (request.pathname.startsWith('/admin')) {
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (user?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}
```

### 8.3 Rate Limiting

**MVP Approach (Simple):**
```typescript
// In-memory rate limiting for auth routes
const attempts = new Map<string, { count: number; timestamp: number }>()

export function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = attempts.get(ip)

  if (!record || now - record.timestamp > 60000) {
    attempts.set(ip, { count: 1, timestamp: now })
    return true
  }

  if (record.count >= 5) {
    return false // Blocked
  }

  record.count++
  return true
}
```

**Post-MVP:**
- Upstash Redis for distributed rate limiting
- Or Vercel Edge Config

### 8.4 API Security

**Every API Route Must:**
1. Verify Supabase session exists
2. Check user role for admin routes
3. Validate input with Zod
4. Scope queries by user_id for user routes

**Template:**
```typescript
export async function GET(request: Request) {
  // 1. Auth check
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Role check (for admin routes)
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (dbUser?.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Input validation
  const { searchParams } = new URL(request.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return Response.json({ error: parsed.error }, { status: 400 })
  }

  // 4. Execute query (scoped if user route)
  const data = await prisma.course.findMany({
    where: { status: 'PUBLISHED' }
  })

  return Response.json(data)
}
```

### 8.5 Input Validation

**Zod for All Inputs:**
```typescript
// lib/validations/course.ts
import { z } from 'zod'

export const CreateCourseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  thumbnailUrl: z.string().url().optional(),
})

export const UpdateCourseSchema = CreateCourseSchema.partial()

export type CreateCourseInput = z.infer<typeof CreateCourseSchema>
```

### 8.6 File Upload Security

**Signed Upload URLs:**
```typescript
// Never expose raw storage URLs
// Always use signed URLs with expiration

export async function GET(request: Request, { params }) {
  const { lessonId } = params

  // Verify user is enrolled in course containing this lesson
  const hasAccess = await verifyLessonAccess(userId, lessonId)
  if (!hasAccess) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } })

  // Generate short-lived signed URL
  const { data, error } = await supabase.storage
    .from('resources')
    .createSignedUrl(lesson.resourceUrl, 60) // 60 seconds

  return Response.json({ url: data.signedUrl })
}
```

**File Type Validation:**
```typescript
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

if (!ALLOWED_TYPES.includes(file.type)) {
  throw new Error('Invalid file type')
}

if (file.size > MAX_SIZE) {
  throw new Error('File too large')
}
```

### 8.7 Environment Variable Handling

**Rules:**
- All secrets in environment variables
- Never commit `.env.local`
- Document required vars in `.env.example`
- Server-only vars don't start with `NEXT_PUBLIC_`

**.env.example:**
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

# Mux
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
MUX_WEBHOOK_SECRET=

# Resend
RESEND_API_KEY=

# GoHighLevel
GHL_WEBHOOK_SECRET=
```

### 8.8 Database Security (RLS)

**Row-Level Security Policies:**
```sql
-- Users can only read their own data
CREATE POLICY "Users can read own data"
ON users FOR SELECT
USING (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Users can only see their own lesson progress
CREATE POLICY "Users can manage own progress"
ON lesson_progress FOR ALL
USING (auth.uid() = user_id);

-- Users can only see their own notes
CREATE POLICY "Users can manage own notes"
ON notes FOR ALL
USING (auth.uid() = user_id);

-- Anyone can read published courses
CREATE POLICY "Anyone can read published courses"
ON courses FOR SELECT
USING (status = 'PUBLISHED');

-- Only admins can modify courses
CREATE POLICY "Admins can manage courses"
ON courses FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'ADMIN'
  )
);
```

### 8.9 Webhook Security

**Mux Webhook Verification:**
```typescript
import crypto from 'crypto'

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('mux-signature')

  const expectedSignature = crypto
    .createHmac('sha256', process.env.MUX_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')

  if (signature !== `sha256=${expectedSignature}`) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Process webhook...
}
```

**GHL Webhook Verification:**
```typescript
export async function POST(request: Request) {
  const secret = request.headers.get('x-ghl-secret')

  if (secret !== process.env.GHL_WEBHOOK_SECRET) {
    return Response.json({ error: 'Invalid secret' }, { status: 401 })
  }

  // Process webhook...
}
```

### 8.10 Logging & Audit Trails

**MVP Logging (Console):**
```typescript
// Log important actions
console.log('[Auth] User logged in', { userId, email })
console.log('[Webhook] GHL payment received', { email, amount })
console.log('[Admin] Course created', { courseId, adminId })
console.error('[Error] Video upload failed', { lessonId, error })
```

**Post-MVP:**
- Structured logging with Pino
- Audit log table for admin actions

### 8.11 Security Checklist: MUST HAVE Now

| Security Measure | Sprint | Notes |
|-----------------|--------|-------|
| Supabase Auth setup | 0 | Built-in password hashing, sessions |
| RLS on all user tables | 0 | Users can only see own data |
| Auth middleware | 1 | Block unauthenticated access |
| Role-based route protection | 1 | Admin routes reject members |
| Zod validation on all APIs | 1+ | Every endpoint validates input |
| Webhook signature verification | 1-2 | Mux and GHL webhooks verified |
| Signed URLs for resources | 5 | No direct storage access |
| HTTPS everywhere | 0 | Vercel + Supabase provide this |

### 8.12 Security Checklist: CAN WAIT Until Post-MVP

| Security Measure | When | Notes |
|-----------------|------|-------|
| Rate limiting | After launch | If abuse observed |
| Audit log table | Phase 2 | For compliance requirements |
| Security headers | Post-MVP | CSP, HSTS via Vercel config |
| Penetration testing | Before scaling | When handling significant payments |
| SOC 2 compliance | When enterprise | Only if selling to large orgs |

---

## 9. Engineering Standards

### 9.1 Folder Structure

```
legacyscale-platform/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group
│   │   ├── login/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── (admin)/                  # Admin route group
│   │   └── admin/
│   │       ├── members/
│   │       ├── courses/
│   │       ├── announcements/
│   │       └── layout.tsx
│   ├── (user)/                   # User route group
│   │   ├── dashboard/
│   │   ├── courses/
│   │   ├── announcements/
│   │   ├── profile/
│   │   └── layout.tsx
│   ├── api/                      # API routes
│   │   ├── admin/
│   │   ├── webhooks/
│   │   └── ...
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Root page (redirect)
├── components/                   # Shared components
│   ├── ui/                       # ShadCN components
│   ├── layout/                   # Sidebar, TopNav, etc.
│   ├── course/                   # Course-specific components
│   └── ...
├── lib/                          # Utilities
│   ├── supabase/                 # Supabase clients
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server Component client
│   │   └── middleware.ts         # Middleware client
│   ├── prisma.ts                 # Prisma client singleton
│   ├── validations/              # Zod schemas
│   └── utils.ts                  # Helper functions
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── public/                       # Static assets
├── styles/
│   └── globals.css               # Tailwind imports
├── types/                        # TypeScript types
│   └── index.ts
├── .env.example
├── .env.local                    # (gitignored)
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### 9.2 Naming Conventions

**Files & Folders:**
- Components: `PascalCase.tsx` (e.g., `CourseCard.tsx`)
- Utilities: `camelCase.ts` (e.g., `formatDate.ts`)
- API routes: `route.ts` (Next.js convention)
- Pages: `page.tsx` (Next.js convention)
- Folders: `kebab-case` (e.g., `forgot-password`)

**Code:**
- Components: `PascalCase` (e.g., `CourseCard`)
- Functions: `camelCase` (e.g., `getCourses`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_FILE_SIZE`)
- Types/Interfaces: `PascalCase` (e.g., `Course`, `CreateCourseInput`)
- Database columns: `snake_case` (Prisma handles conversion)

### 9.3 API Conventions

**REST Patterns:**
| Method | Path | Action |
|--------|------|--------|
| GET | /api/courses | List courses |
| GET | /api/courses/[id] | Get single course |
| POST | /api/courses | Create course |
| PATCH | /api/courses/[id] | Update course |
| DELETE | /api/courses/[id] | Delete course |

**Response Format:**
```typescript
// Success
{ data: Course | Course[], meta?: { total: number, page: number } }

// Error
{ error: string, details?: ZodError }
```

**Status Codes:**
- 200: Success (GET, PATCH)
- 201: Created (POST)
- 204: No Content (DELETE)
- 400: Bad Request (validation error)
- 401: Unauthorized (not logged in)
- 403: Forbidden (wrong role)
- 404: Not Found
- 500: Server Error

### 9.4 Component Conventions

**Component Structure:**
```tsx
// components/course/CourseCard.tsx
import { type FC } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface CourseCardProps {
  course: Course
  progress?: number
  className?: string
}

export const CourseCard: FC<CourseCardProps> = ({
  course,
  progress,
  className,
}) => {
  return (
    <Card className={cn('hover:border-brand-500', className)}>
      <CardHeader>
        <img
          src={course.thumbnailUrl || '/placeholder-course.jpg'}
          alt={course.title}
          className="rounded-lg aspect-video object-cover"
        />
      </CardHeader>
      <CardContent>
        <h3 className="font-semibold">{course.title}</h3>
        {progress !== undefined && (
          <Progress value={progress} className="mt-2" />
        )}
      </CardContent>
    </Card>
  )
}
```

**Rules:**
- One component per file
- Props interface defined above component
- Use `FC` type for functional components
- Export named exports (not default)
- Colocate component-specific types

### 9.5 Code Quality Standards

**TypeScript:**
- Strict mode enabled
- No `any` types (use `unknown` if needed)
- Explicit return types on functions
- Use type inference where obvious

**ESLint Config:**
```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    'prefer-const': 'error',
  },
}
```

### 9.6 Linting & Formatting

**Prettier Config:**
```json
// .prettierrc
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80
}
```

**Scripts:**
```json
// package.json
{
  "scripts": {
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "type-check": "tsc --noEmit"
  }
}
```

### 9.7 Documentation Standards

**Code Comments:**
- Explain "why", not "what"
- Use JSDoc for exported functions
- No commented-out code in commits

**README.md:**
```markdown
# Legacy Scale Platform

## Quick Start
1. Clone repo
2. Copy `.env.example` to `.env.local`
3. Fill in environment variables
4. `pnpm install`
5. `pnpm dev`

## Development
- `pnpm dev` — Start development server
- `pnpm build` — Build for production
- `pnpm lint` — Run ESLint
- `pnpm type-check` — Check TypeScript

## Environment Variables
See `.env.example` for required variables.

## Deployment
Push to `main` branch triggers Vercel deployment.
```

### 9.8 Commit Conventions

**Conventional Commits:**
```
<type>(<scope>): <description>

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting (no code change)
- refactor: Code restructuring
- test: Adding tests
- chore: Maintenance

Examples:
feat(auth): add login page
fix(video): handle Mux webhook timeout
docs(readme): add environment setup
chore(deps): update dependencies
```

### 9.9 Recommended Tooling

| Tool | Purpose | Config File |
|------|---------|-------------|
| TypeScript | Type safety | tsconfig.json |
| ESLint | Linting | .eslintrc.js |
| Prettier | Formatting | .prettierrc |
| Husky | Git hooks | .husky/ |
| lint-staged | Pre-commit checks | package.json |

**Pre-commit Hook:**
```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

---

## 10. QA & Testing Strategy

### 10.1 Testing Philosophy for Solo Dev

**Principle: Test What Matters, Skip What Doesn't**

For a solo developer on a tight timeline:
- Don't aim for 100% coverage
- Focus on high-risk, high-value tests
- Manual testing is fine for UI
- Automated tests for critical paths

### 10.2 What Must Be Automated

| Test Type | What to Test | Why |
|-----------|-------------|-----|
| E2E | Member login → watch video → complete lesson | Critical happy path |
| E2E | Admin create course → publish → verify visible | Content flow |
| E2E | Quiz flow (take quiz, see results) | Complex state |
| Integration | Webhook handlers (Mux, GHL) | Hard to test manually |
| Unit | Date formatting, progress calculation | Pure logic |

### 10.3 What Can Be Manual

| Area | Manual Testing Approach |
|------|------------------------|
| UI styling | Visual inspection |
| Responsive design | Chrome DevTools |
| Form validation | Fill forms with bad data |
| Empty states | Clear test data |
| Error handling | Trigger errors intentionally |

### 10.4 Unit Testing Strategy

**Framework:** Vitest (fast, Vite-powered)

**What to Unit Test:**
```typescript
// lib/utils.test.ts
import { describe, it, expect } from 'vitest'
import { calculateProgress, formatDuration } from './utils'

describe('calculateProgress', () => {
  it('returns 0 when no lessons completed', () => {
    expect(calculateProgress(0, 10)).toBe(0)
  })

  it('returns 100 when all lessons completed', () => {
    expect(calculateProgress(10, 10)).toBe(100)
  })

  it('handles edge case of 0 total lessons', () => {
    expect(calculateProgress(0, 0)).toBe(0)
  })
})

describe('formatDuration', () => {
  it('formats seconds to mm:ss', () => {
    expect(formatDuration(90)).toBe('1:30')
  })
})
```

### 10.5 Integration Testing Strategy

**Framework:** Vitest with MSW (Mock Service Worker)

**What to Integration Test:**
```typescript
// api/courses/route.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { GET, POST } from './route'

describe('GET /api/courses', () => {
  it('returns published courses', async () => {
    const response = await GET(new Request('http://localhost/api/courses'))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.every(c => c.status === 'PUBLISHED')).toBe(true)
  })
})

describe('POST /api/courses', () => {
  it('rejects unauthenticated requests', async () => {
    const response = await POST(new Request('http://localhost/api/courses', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test' }),
    }))

    expect(response.status).toBe(401)
  })
})
```

### 10.6 End-to-End Testing Strategy

**Framework:** Playwright

**Critical E2E Tests:**
```typescript
// tests/e2e/member-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Member Course Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test member
    await page.goto('/login')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'testpassword')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')
  })

  test('can browse and start a course', async ({ page }) => {
    await page.click('text=Courses')
    await page.click('.course-card >> first')
    await expect(page.locator('.video-player')).toBeVisible()
  })

  test('can complete a lesson', async ({ page }) => {
    // Navigate to course player
    await page.goto('/courses/test-course/lessons/1')

    // Mark complete
    await page.click('text=Mark as Complete')
    await expect(page.locator('.checkmark')).toBeVisible()
  })
})
```

### 10.7 Regression Prevention

**Strategy:**
1. Write E2E test for each major feature as it's completed
2. Run tests before merging PRs
3. Fix failing tests before new features

**CI Integration:**
```yaml
# .github/workflows/test.yml
name: Tests

on: [pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test
      - run: pnpm test:e2e
```

### 10.8 Release Checklist

**Before Every Production Deployment:**

```markdown
## Pre-Deployment Checklist

### Code Quality
- [ ] All TypeScript errors resolved
- [ ] ESLint passes
- [ ] No console.log debugging statements
- [ ] No hardcoded test data

### Testing
- [ ] E2E tests pass
- [ ] Manual smoke test on preview URL
- [ ] Tested on mobile viewport

### Security
- [ ] RLS policies reviewed
- [ ] No secrets in code
- [ ] API routes have auth checks

### Database
- [ ] Migrations backwards compatible
- [ ] No data-destroying changes

### Functionality
- [ ] Login/logout works
- [ ] Course navigation works
- [ ] Video playback works
- [ ] Quiz submission works
- [ ] Progress tracking updates

### Admin
- [ ] Admin can access admin panel
- [ ] Members cannot access admin panel
```

---

## 11. Delivery & Sprint Preparation

### 11.1 Sprint Validation

**Current Sprint Plan Analysis:**

| Sprint | Focus | Allocation | Assessment |
|--------|-------|------------|------------|
| Sprint 0 | Foundation | 40 hrs | Reasonable, may be tight |
| Sprint 1 | Auth + Members | 40 hrs | Realistic, includes GHL webhook |
| Sprint 2 | Course/Chapter/Lesson | 40 hrs | Ambitious, Mux integration is complex |
| Sprint 3 | Quiz + Announcements | 40 hrs | Manageable |
| Sprint 4 | Course Library + Player | 40 hrs | Core feature, needs focus |
| Sprint 5 | Quiz Player + Resources + Notes | 40 hrs | Realistic |
| Sprint 6 | Dashboard + Profile + Polish | 40 hrs | Should have buffer for fixes |
| Sprint 7 | QA + Security + Launch | 40 hrs | Critical, don't rush |

### 11.2 Identified Unrealistic Timelines

**Sprint 2 Risk: Mux Integration**
- Mux upload + webhook handling is new for most devs
- Debugging async webhook flows takes time
- **Mitigation:** Prove Mux integration in Sprint 0

**Sprint 4 Risk: Course Player Complexity**
- Split layout with sidebar
- Video player with progress events
- Navigation across chapters
- **Mitigation:** Start with simple layout, iterate

**Sprint 7 Risk: QA Compression**
- Tendency to rush QA
- Security audit gets skipped
- **Mitigation:** Strict "no new features" in Sprint 7

### 11.3 Identified Blockers

| Blocker | Dependency | Required By |
|---------|------------|-------------|
| GHL webhook payload format | Keanu | Sprint 1 |
| Video content files | Keanu | Sprint 4 |
| Domain DNS access | Keanu | Sprint 7 |
| Production Supabase setup | Developer | Sprint 7 |

### 11.4 Parallelization Opportunities

**What Can Run in Parallel:**
- Design system setup || Database schema design (Sprint 0)
- Admin course management || User profile page (Sprint 1-2)
- Quiz builder || Announcements admin (Sprint 3)
- Course library || Course player skeleton (Sprint 4)

**What Must Be Sequential:**
- Course management → Chapter management → Lesson management
- Quiz builder → Quiz player
- All features → QA testing

### 11.5 Realistic Delivery Pacing

**Recommended Sprint Adjustments:**

| Original | Recommended | Rationale |
|----------|-------------|-----------|
| Sprint 0: 40h | Sprint 0: 40h | Keep as-is, foundation is critical |
| Sprint 1: 40h | Sprint 1: 45h | GHL webhook needs buffer |
| Sprint 2: 40h | Sprint 2: 48h | Mux is complex, allow more time |
| Sprint 3: 40h | Sprint 3: 35h | Simpler than estimated |
| Sprint 4: 40h | Sprint 4: 45h | Course player is core feature |
| Sprint 5: 40h | Sprint 5: 40h | Keep as-is |
| Sprint 6: 40h | Sprint 6: 35h | Reduce scope if behind |
| Sprint 7: 40h | Sprint 7: 45h | Never rush security |

**Total: 320h → 333h** (reasonable variance)

### 11.6 Refined Sprint Preparation Plan

**Sprint 0 Preparation (Now):**
- [ ] Create GitHub repository
- [ ] Set up Supabase project
- [ ] Set up Mux account
- [ ] Set up Resend account
- [ ] Set up Vercel account
- [ ] Get GHL webhook sample from Keanu
- [ ] Confirm Keanu has video content ready

**Sprint 1 Preparation:**
- [ ] Finalize users table schema
- [ ] Document GHL webhook handling
- [ ] Create welcome email template

**Sprint 2 Preparation:**
- [ ] Finalize course/chapter/lesson schema
- [ ] Test Mux upload flow
- [ ] Plan admin course builder UX

### 11.7 Development Workflow

**Daily Flow:**
1. Check todo list for today's tasks
2. Create/update feature branch
3. Implement feature
4. Test locally
5. Push branch, verify preview
6. Merge to main if passing

**Weekly Flow:**
1. Monday: Sprint planning, prioritize tasks
2. Daily: Feature development
3. Friday: Demo to Keanu, deploy to production
4. Weekend: Document, clean up

### 11.8 Review Workflow

**Self-Review (Solo Dev):**
- Before merging PR, review own diff
- Check for security issues
- Check for TypeScript errors
- Test on preview deployment

**Keanu Review (Weekly):**
- Friday demo of completed features
- Show working software on staging URL
- Get feedback, create tickets for changes
- Changes go into next sprint

### 11.9 Deployment Workflow

**Preview (Every PR):**
1. Push branch
2. Vercel creates preview deployment
3. Test on preview URL
4. Share with Keanu if needed

**Production (On Merge to Main):**
1. Merge PR to main
2. Vercel auto-deploys
3. Verify production URL
4. Monitor for errors

**Rollback (If Issues):**
1. Go to Vercel dashboard
2. Click on previous deployment
3. Click "Promote to Production"
4. Live in ~30 seconds

---

## 12. Risk Assessment

### 12.1 Technical Risks

| Risk | Probability | Impact | Mitigation | Contingency |
|------|-------------|--------|------------|-------------|
| Mux webhook unreliable | Medium | High | Retry logic, polling fallback | Manual video status update |
| GHL webhook format changes | Low | High | Version the handler, log payloads | Manual member activation |
| Supabase RLS misconfiguration | Medium | Critical | Test as different users, audit before deploy | Disable RLS temporarily, fix immediately |
| Video encoding delays | Medium | Medium | Show processing status, async handling | Member sees "Processing..." |
| Prisma migration failure | Low | High | Test migrations on staging first | Rollback migration, fix schema |

### 12.2 Client Risks

| Risk | Probability | Impact | Mitigation | Contingency |
|------|-------------|--------|------------|-------------|
| Keanu adds features mid-sprint | High | Medium | Strict change request process | Add to backlog, not current sprint |
| Video content not ready | Medium | High | Confirm timeline in Phase 0 | Use placeholder videos |
| Slow feedback cycles | Medium | Medium | Weekly demos, async updates | Proceed with best judgment |
| DNS/domain access delayed | Low | High | Request early in Sprint 6 | Launch on vercel.app subdomain |

### 12.3 Timeline Risks

| Risk | Probability | Impact | Mitigation | Contingency |
|------|-------------|--------|------------|-------------|
| Sprint 2 runs over (Mux) | High | Medium | Prove Mux in Sprint 0 | Cut drag-drop reorder |
| Sprint 7 compressed | Medium | High | No new features in Sprint 7 | Extend by 1 week |
| Overall project runs over | Medium | Medium | Weekly timeline review | Cut from "nice-to-have" list |

### 12.4 Infrastructure Risks

| Risk | Probability | Impact | Mitigation | Contingency |
|------|-------------|--------|------------|-------------|
| Vercel function timeout | Low | Medium | Optimize long operations | Use background jobs |
| Supabase rate limits | Low | Low | Monitor usage, cache reads | Upgrade plan |
| Mux cost unexpectedly high | Medium | Medium | Set budget alerts | Reduce video quality |

### 12.5 Solo Developer Risks

| Risk | Probability | Impact | Mitigation | Contingency |
|------|-------------|--------|------------|-------------|
| Developer illness | Medium | High | Document everything, clean code | Pause project, handoff docs |
| Burnout | Medium | Medium | Sustainable 40hr weeks | Take a week off |
| Knowledge gaps | Medium | Medium | Claude Code for assistance | External consultant for specific issues |
| No code review | High | Medium | Self-review checklist, Keanu tests | Post-launch audit |

---

## 13. Recommended Tools Stack

### 13.1 Development Tools

| Tool | Purpose | Cost | Alternative |
|------|---------|------|-------------|
| VS Code | IDE | Free | WebStorm ($199/yr) |
| GitHub Copilot | AI code assistance | $10/mo | Claude Code, Cursor |
| Postman | API testing | Free | Insomnia (free) |
| TablePlus | Database GUI | $89 one-time | Supabase dashboard (free) |
| Warp | Terminal | Free | iTerm2 (free) |

### 13.2 Productivity Tools

| Tool | Purpose | Cost | Alternative |
|------|---------|------|-------------|
| Linear | Issue tracking | Free (personal) | GitHub Issues (free) |
| Notion | Documentation | Free | Markdown files (free) |
| Loom | Async video updates | Free | Loom (free tier) |
| Excalidraw | Diagrams | Free | draw.io (free) |

### 13.3 Monitoring Tools

| Tool | Purpose | Cost | Alternative |
|------|---------|------|-------------|
| Vercel Analytics | Web analytics | Free | None needed |
| Sentry | Error tracking | Free (5K/mo) | LogRocket ($99/mo) |
| Uptime Robot | Uptime monitoring | Free | Better Uptime (free) |
| Supabase Dashboard | DB monitoring | Free | None needed |

### 13.4 Design Tools

| Tool | Purpose | Cost | Alternative |
|------|---------|------|-------------|
| Figma | UI design | Free | Sketch ($99/yr) |
| Heroicons | Icons | Free | Lucide (free) |
| Unsplash | Stock photos | Free | Pexels (free) |
| Coolors | Color palettes | Free | None needed |

### 13.5 Communication Tools

| Tool | Purpose | Cost | Alternative |
|------|---------|------|-------------|
| Slack | Async chat | Free | Discord (free) |
| Loom | Video updates | Free | Zoom recordings |
| Google Meet | Sync calls | Free | Zoom (free tier) |
| Email | Formal communication | Free | None |

### 13.6 Deployment Tools

| Tool | Purpose | Cost | Alternative |
|------|---------|------|-------------|
| Vercel | Hosting | Free/Hobby | Railway (~$5/mo) |
| GitHub Actions | CI/CD | Free | None needed |
| Supabase | BaaS | Free | PlanetScale + Auth0 |
| Mux | Video | Pay-as-you-go | Cloudflare Stream |
| Resend | Email | Free (100/day) | SendGrid (free tier) |

---

## 14. Phase 0 Deliverables Checklist

### 14.1 Documents

- [ ] Architecture Decision Record (ADR) for stack choices
- [ ] Database schema diagram
- [ ] API endpoint documentation (initial)
- [ ] Environment variables documentation (.env.example)
- [ ] README with setup instructions
- [ ] Change request process document

### 14.2 Architecture Decisions

- [ ] Stack finalized: Next.js 14 + Supabase + Prisma + Mux
- [ ] Folder structure established
- [ ] API naming conventions defined
- [ ] Component conventions defined
- [ ] State management approach defined (server-first)

### 14.3 Environments

- [ ] Local development working (`pnpm dev`)
- [ ] Supabase local (Docker) optional, or use cloud dev project
- [ ] Staging via Vercel preview deployments
- [ ] Production URL configured (app.legacyscale.co)

### 14.4 Repositories

- [ ] GitHub repository created
- [ ] Branch protection on main
- [ ] PR template added
- [ ] .gitignore configured
- [ ] CI workflow (lint + type-check)

### 14.5 Third-Party Accounts

- [ ] Supabase project created + API keys
- [ ] Mux account created + API keys
- [ ] Resend account created + domain verified
- [ ] Vercel account connected to GitHub
- [ ] GHL webhook secret obtained from Keanu

### 14.6 Design Assets

- [ ] Tailwind config with brand colors
- [ ] ShadCN/UI installed and configured
- [ ] Dark theme enabled
- [ ] Layout shells (Admin sidebar, User sidebar)
- [ ] Loading skeleton components

### 14.7 Technical Validations

- [ ] Supabase Auth login/logout working
- [ ] Prisma connected to Supabase
- [ ] Database schema pushed
- [ ] RLS policies defined (documentation)
- [ ] Mux upload test successful
- [ ] Vercel deployment successful

### 14.8 Workflows

- [ ] Development workflow documented
- [ ] Deployment workflow documented
- [ ] Weekly demo schedule agreed
- [ ] Communication channels established

### 14.9 Approvals

- [ ] MVP scope confirmed with Keanu
- [ ] Sprint timeline approved
- [ ] Technology stack approved
- [ ] Change request process agreed

---

## 15. Suggested Timeline

### Week 1: Phase 0 (Sprint 0)

**Day 1-2: Setup & Configuration**
- [ ] Create GitHub repository
- [ ] Initialize Next.js 14 project
- [ ] Configure TypeScript, ESLint, Prettier
- [ ] Set up Tailwind CSS + ShadCN
- [ ] Create Supabase project
- [ ] Configure environment variables

**Day 3: Database & Auth**
- [ ] Design full Prisma schema
- [ ] Push schema to Supabase
- [ ] Configure Supabase Auth
- [ ] Create auth middleware

**Day 4: Layout & Routing**
- [ ] Build admin layout shell
- [ ] Build user layout shell
- [ ] Set up route groups
- [ ] Create placeholder pages

**Day 5: Deploy & Validate**
- [ ] Deploy to Vercel
- [ ] Test login flow
- [ ] Test Mux integration (upload test)
- [ ] Document setup for handoff

### Week 1 Milestones

| Milestone | Success Criteria |
|-----------|-----------------|
| M0.1 | Repository exists, CI passing |
| M0.2 | Local dev runs with one command |
| M0.3 | Auth flow working (login/logout) |
| M0.4 | Deployed to production URL |
| M0.5 | All third-party accounts configured |

### Week 1 Dependencies

| Dependency | Owner | Due |
|------------|-------|-----|
| GHL webhook sample payload | Keanu | Day 2 |
| Brand colors/assets | Keanu | Day 3 |
| Domain DNS access | Keanu | Day 5 |

### Week 1 Outputs

1. Working skeleton deployed to app.legacyscale.co
2. All development environment documented
3. Sprint 1 ready to begin
4. All risks identified and mitigated

---

## 16. Final Recommendation

### 16.1 Biggest Risks

1. **Scope Creep**: The PDF proposal scope is 3x larger than the Excel MVP. Stick to Excel scope.
2. **Mux Integration Complexity**: Video upload + webhook handling has hidden edge cases. Prove it early.
3. **Solo Developer Bottleneck**: No backup, no reviewer. Document everything, write clean code.
4. **QA Compression**: Sprint 7 always gets squeezed. Protect it.

### 16.2 Biggest Opportunities

1. **Speed to Revenue**: 8-week MVP means Keanu can monetize in 2 months, not 6.
2. **Simple Architecture**: No microservices, no Kubernetes, no Redis. Just Next.js + Supabase.
3. **Claude Code Acceleration**: AI pair programming can cut 20-30% off development time.
4. **Differentiation**: Custom LMS with quiz system beats generic Skool for agency training.

### 16.3 What Will Make This MVP Succeed

1. **Stick to the 17-module scope**: Resist adding AI tools, gamification, analytics.
2. **Video content ready**: Keanu must have course videos before Sprint 4.
3. **Weekly demos**: Keanu sees progress, provides feedback, stays engaged.
4. **No perfect is the enemy of done**: Ship 80% features, polish later.

### 16.4 What Will Likely Cause Delays/Failure

1. **Scope inflation**: "Just one more feature" × 10 = project failure.
2. **Content not ready**: Can't test video player without videos.
3. **Mux/GHL integration bugs**: Async webhooks are debugging nightmares.
4. **Skipping Phase 0**: Starting Sprint 1 without proper setup = constant foundation issues.

### 16.5 Strongest Recommendation for Solo Developer Setup

**Do This:**
- Use Claude Code / Copilot as a constant pair programmer
- Keep Linear or GitHub Issues for task tracking
- Send Keanu a Loom video every Friday instead of meetings
- Write tests only for critical paths (auth, payments, webhooks)
- Deploy to production early, iterate publicly
- Take breaks — 8 weeks of 40hr weeks is sustainable, 60hr weeks is not

**Don't Do This:**
- Don't add features not in the Excel spreadsheet
- Don't build custom solutions when a library exists
- Don't optimize prematurely (no caching, no CDN tuning, no Redis)
- Don't skip the security checklist in Sprint 7
- Don't work without a working staging environment

---

## Summary

This Phase 0 Plan provides the complete foundation for building the Legacy Scale MVP. By following this plan:

1. **Technical decisions are made upfront** — no mid-project stack changes
2. **Scope is locked** — 17 modules, 8 sprints, no AI/gamification
3. **Infrastructure is ready** — deploy on day 1, iterate fast
4. **Risks are mitigated** — Mux proven early, GHL payload documented
5. **Quality is maintained** — security checklist, release process

The MVP is achievable in 8 weeks at 40 hours/week. The key is discipline: build exactly what's in the spreadsheet, nothing more.

---

**Document Prepared By:** Phase 0 Planning Agent
**Date:** Pre-Sprint 0
**Next Review:** End of Week 1 (Sprint 0 Complete)
