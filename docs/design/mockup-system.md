# Legacy Scale — Mockup System & Design Documentation

> Companion to the clickable prototype. Run the app and open **`/prototype`**.
> This document covers the thinking behind the screens: user flows, information
> architecture, navigation, component structure, the design system, UI patterns,
> and responsiveness. The prototype itself is high-fidelity, fully clickable,
> and powered by realistic mock data.

---

## 1. What Legacy Scale is (MVP analysis)

Legacy Scale is a **course / LMS SaaS** built around the "7-Figure Agency
Program." Two roles, each with distinct goals:

| Role | Who | Primary goals |
|---|---|---|
| **ADMIN** | Keanu & coaches | Author courses, manage members & access, broadcast announcements, watch engagement |
| **MEMBER** | Agency students | Resume learning, complete lessons, pass quizzes, take notes, track progress |

**Domain hierarchy:** `Course → Chapter → Lesson`, where a lesson is one of
**VIDEO** (Mux), **QUIZ** (multiple-choice / true-false, passing score, attempts),
or **RESOURCE** (downloadable file).

**The four workflows the design is built around:**
1. **Member learning loop** *(the core)* — Dashboard → *Continue learning*
   (resumes at the saved position) → lesson player → mark complete / pass quiz →
   progress updates.
2. **Admin authoring** — create course (DRAFT) → add chapters & lessons →
   configure each lesson type → publish.
3. **Enrollment & access** — members arrive via **GoHighLevel webhook** (purchase),
   manual, admin, or self-enroll; status is PENDING / ACTIVE / EXPIRED / REVOKED;
   access is lifetime or time-limited.
4. **Engagement & comms** — announcements (DRAFT → PUBLISHED) with per-member read
   tracking; per-lesson notes.

**Data-visibility rules baked into the UI:** admins see everyone; members see only
their own enrollments, progress, and notes; revoked users hit the access-revoked
screen; DRAFT/ARCHIVED courses are hidden from members.

**Deliberate Phase-2 boundary:** the MVP ships lean — winning on content and the
core learning experience first. Higher-complexity and scale-driven capabilities
(AI suite, gamification, live events, BI analytics, mobile app, and more) are
sequenced into a **Phase 2 Roadmap** (in the Admin console), each with a deferral
rationale and a build-trigger — so the plan is visible without bloating the MVP.

---

## 2. User flows

**Member (first run):** Sign up → **Onboarding** (welcome → profile → goal →
first course) → Dashboard.

**Member (returning, the hero loop):**
Dashboard → *Continue learning* → **Lesson player**
→ (VIDEO) watch → mark complete · (QUIZ) intro → answer → results → retake
· (RESOURCE) download → mark complete → next lesson → progress updates.

**Admin (publish a course):**
Courses → **Course builder** → add chapter → add lesson → **Lesson editor**
(type-specific: Mux upload / file / quiz questions) → Publish.

**Admin (manage a member):**
Members → **Member detail** → review enrollments / quiz attempts / activity →
change role or revoke access (with reason).

**Admin (broadcast):** Announcements → editor → publish → watch read-rate.

---

## 3. Information architecture & navigation

Persistent **left sidebar** + sticky **top bar** (search, ⌘K command palette,
theme toggle, notifications, avatar menu). A floating **Prototype** button
(bottom-right) jumps between Admin / Member / Design System on any screen.

**Admin** (`/prototype/admin/*`)
```
Overview · Analytics
Content:  Courses → builder → lesson/quiz editor · Announcements → editor
People:   Members → member detail · Enrollments
System:   Settings · Phase 2 Roadmap
```

**Member** (`/prototype/member/*`)
```
Dashboard · My Courses → course detail → Lesson player (video/quiz/resource)
Notifications · Activity · Account (Profile/Password/Access) · Help
```

**Full-screen (no shell):** Sign in / Sign up / Forgot password · Onboarding ·
Access revoked.

---

## 4. Screen index (what's in the prototype)

**Admin — Phase 1 (built):** Dashboard, Analytics, Courses list, Course builder,
Lesson editor + Quiz builder (dialog), Members list, Member detail, Enrollments,
Announcements list, Announcement editor, Settings (Profile/Platform/Integrations/Team).

**Admin — Phase 2 Roadmap:** a sequenced post-MVP plan — AI Marketing Copy
Generator, AI Proposal Builder, AI Coaching Agent, Gamification, Certificates,
Live Event Calendar, Google Calendar OAuth, BI Analytics Dashboard, Email
Notification Preferences, Course Search, Mobile App — each with a deferral
rationale and a build-trigger.

**Member — Phase 1 (built):** Onboarding, Dashboard, My Courses, Course detail,
Lesson player (VIDEO / QUIZ / RESOURCE), Notifications, Activity, Account & Access,
Help, Access revoked.

**Shared:** Sign in / Sign up / Forgot password, Design System showcase.

---

## 5. Frontend architecture

The prototype lives in an **isolated route group** so it never disturbs the real
app, and reuses the installed ShadCN/UI primitives — **zero new dependencies**.

```
app/(prototype)/
├─ layout.tsx                 # floating Prototype navigator
└─ prototype/
   ├─ page.tsx                # presentation hub
   ├─ design-system/          # living style guide
   ├─ admin/  (layout = AppShell role="admin")  → all admin screens
   ├─ member/ (layout = AppShell role="member") → all member screens
   ├─ auth/ · onboarding/ · access-revoked/      # full-screen, no shell

components/prototype/
├─ shell/    app-shell · sidebar-nav · top-bar · command-palette · user-menu
│            brand-mark · theme-toggle · prototype-navigator · nav-config
├─ shared/   page-container · page-header · section-card · stat-card
│            status-badge · progress-ring · empty-state · activity-feed · coming-soon
├─ charts/   area-chart · bar-chart · donut-chart · sparkline   (hand-built SVG)
├─ courses/  course-builder · lesson-editor-dialog · curriculum-outline · lesson-type-badge
├─ member/   course-card
└─ learn/    video-frame · quiz-runner · notes-panel · resource-view · mark-complete-button

lib/prototype/   types · courses · people · engagement · format   (typed mock data
                 mirroring the Prisma models, so it doubles as fixtures)
```

**Conventions:** pages are thin server components composing shared pieces;
`"use client"` only where there's real interactivity (theme toggle, command
palette, course builder, quiz runner, notes, onboarding wizard). Dynamic routes
await `params` (Next 16). Files stay < 300 lines; functions < 30.

---

## 6. Design system

Reuses the tokens already defined in `app/globals.css` — **no redefinition**.

- **Color:** primary/brand **Legacy Scale red `#D11A1A`** (sampled from the brand
  logo) with the full `brand-50…950` red ramp; the real "LS" orbital-ring logo is
  used in the brand mark (`public/legacy-scale-logo.png`).
  Semantic `success #22c55e`, `warning #f59e0b`, `error #ef4444`. Surfaces and
  text via `background / card / muted / foreground / muted-foreground`. Status
  colors map through `StatusBadge` (ACTIVE→success, PENDING/EXPIRED→warning,
  REVOKED→error, DRAFT→neutral, ADMIN→info).
- **Typography:** Inter (sans) + JetBrains Mono (numerics/IDs). Scale: page title
  `text-2xl/3xl font-semibold` → section `text-lg/sm font-semibold` → body
  `text-sm` → caption `text-xs text-muted-foreground`.
- **Spacing:** 4px grid (gap/padding 2,3,4,6,8…); card padding `p-4`–`p-6`;
  section rhythm `mt-6`/`space-y-6`. No arbitrary values.
- **Radius:** `rounded-lg` controls, `rounded-xl` cards/dialogs.
- **Dark mode:** dark-by-default (matches the app + Linear/Vercel aesthetic); a
  top-bar toggle flips the `.dark` class. Both modes share one token set.

The live, interactive version of all of this is at **`/prototype/design-system`**.

---

## 7. UI patterns (standardized across screens)

- **Sidebar** with section labels + active indicator (primary-tinted).
- **Top bar** with a ⌘K command palette (also openable from the search field).
- **Modern data tables** — sticky-feeling header, row hover, filter chips,
  status badges, inline progress bars; every list has an **empty state**.
- **Detail via dialog** — the lesson editor / quiz builder opens as a focused
  modal from the course builder.
- **KPI stat cards** with trend delta + sparkline.
- **Progress** shown as bars (lists) and rings (cards/analytics).
- **Toasts** (Sonner) confirm actions (e.g., "Lesson marked complete").
- **Hand-built SVG charts** (area / bar / donut / sparkline) — crisp, theme-driven.

---

## 8. Responsiveness & mobile

- Breakpoints: mobile `< 768`, tablet `768–1024`, desktop `> 1024`.
- The **sidebar** collapses behind a hamburger that opens a slide-in **drawer**
  on mobile/tablet; the top bar's search + actions stay reachable.
- **Tables** scroll horizontally within their card on small screens; member-facing
  lists become stacked rows.
- The **lesson player** reflows from two columns (content + curriculum) to a single
  stacked column; the curriculum sits below the player.
- Auth and onboarding use a **split layout** that drops the brand panel on mobile.

---

## 9. How to review

1. `npm run dev`, then open **`/prototype`** — the presentation hub.
2. **Admin:** Overview → Courses → open the builder → edit a lesson (try the
   QUIZ lesson to see the quiz builder) → Members → a member → Enrollments →
   Analytics → Announcements → Settings.
3. **Member:** Dashboard → *Resume lesson* (video player + notes) → open a QUIZ
   lesson and take it (intro → questions → results → retake) → My Courses →
   a course → Notifications → Account → Help.
4. Try **⌘K**, toggle **light/dark**, and resize to mobile width.
5. Visit **`/prototype/design-system`** for the token + component showcase.

Verified green: `npm run type-check`, `npm run lint`, and `npm run build`
(34 routes compile; the prototype is fully isolated from the real app).
