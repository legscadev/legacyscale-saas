import type {
  ActivityItem,
  Announcement,
  KpiStat,
  QuizAttempt,
  TrendPoint,
} from "./types"

export const announcements: Announcement[] = [
  {
    id: "a-001",
    title: "New Module: Scaling to 7-Figures is live",
    body:
      "Chapter 4 just dropped. Learn the exact hiring sequence and SOP " +
      "system our top members use to scale past $100k/mo. Jump in from your " +
      "dashboard.",
    status: "PUBLISHED",
    publishedAt: "2026-05-26T09:00:00Z",
    readRate: 42,
    read: false,
  },
  {
    id: "a-002",
    title: "Live Q&A with Keanu — Thursday 2PM EST",
    body:
      "Bring your toughest acquisition and sales questions. We'll be going " +
      "deep on cold outreach that's working right now. Replay will be posted " +
      "for everyone.",
    status: "PUBLISHED",
    publishedAt: "2026-05-24T15:30:00Z",
    readRate: 78,
    read: true,
  },
  {
    id: "a-003",
    title: "Welcome to Kondense!",
    body:
      "We're excited to have you in the community. Start with the 7-Figure " +
      "Agency Program to begin your journey.",
    status: "PUBLISHED",
    publishedAt: "2026-01-10T12:00:00Z",
    readRate: 94,
    read: true,
  },
  {
    id: "a-004",
    title: "Q3 Bonus Workshop (draft)",
    body: "Outline for the upcoming operations workshop. Not yet published.",
    status: "DRAFT",
    readRate: 0,
  },
]

export const memberQuizAttempts: QuizAttempt[] = [
  {
    id: "qa-001",
    lessonTitle: "Module 1 Quiz",
    courseTitle: "7-Figure Agency Program",
    score: 3,
    total: 3,
    passed: true,
    createdAt: "2026-02-02T14:20:00Z",
  },
  {
    id: "qa-002",
    lessonTitle: "Module 1 Quiz",
    courseTitle: "7-Figure Agency Program",
    score: 2,
    total: 3,
    passed: false,
    createdAt: "2026-02-01T18:05:00Z",
  },
]

export const adminActivity: ActivityItem[] = [
  {
    id: "act-1",
    type: "member_joined",
    actor: "Isabella Cruz",
    target: "joined via GoHighLevel",
    timestamp: "2026-05-27T07:45:00Z",
  },
  {
    id: "act-2",
    type: "completion",
    actor: "Sofia Reyes",
    target: "completed “The High-Ticket Sales Call”",
    timestamp: "2026-05-27T07:12:00Z",
  },
  {
    id: "act-3",
    type: "quiz_passed",
    actor: "David Okafor",
    target: "passed “Module 2 Quiz” (90%)",
    timestamp: "2026-05-27T06:30:00Z",
  },
  {
    id: "act-4",
    type: "enrollment",
    actor: "Marcus Lee",
    target: "enrolled in 7-Figure Agency Program",
    timestamp: "2026-05-26T22:18:00Z",
  },
  {
    id: "act-5",
    type: "quiz_failed",
    actor: "Amara Singh",
    target: "did not pass “Module 1 Quiz” (60%)",
    timestamp: "2026-05-26T20:02:00Z",
  },
  {
    id: "act-6",
    type: "announcement",
    actor: "Keanu Vasquez",
    target: "published “New Module: Scaling to 7-Figures”",
    timestamp: "2026-05-26T09:00:00Z",
  },
]

export const memberActivity: ActivityItem[] = [
  {
    id: "m-act-1",
    type: "lesson_started",
    actor: "You",
    target: "resumed “Finding High-Ticket Clients”",
    timestamp: "2026-05-27T07:02:00Z",
  },
  {
    id: "m-act-2",
    type: "completion",
    actor: "You",
    target: "completed “Setting Your Foundation”",
    timestamp: "2026-05-24T16:40:00Z",
  },
  {
    id: "m-act-3",
    type: "quiz_passed",
    actor: "You",
    target: "passed “Module 1 Quiz” (100%)",
    timestamp: "2026-02-02T14:20:00Z",
  },
  {
    id: "m-act-4",
    type: "completion",
    actor: "You",
    target: "completed “Welcome to the Program”",
    timestamp: "2026-01-16T10:15:00Z",
  },
  {
    id: "m-act-5",
    type: "enrollment",
    actor: "You",
    target: "enrolled in 7-Figure Agency Program",
    timestamp: "2026-01-15T09:00:00Z",
  },
]

export const adminKpis: KpiStat[] = [
  {
    label: "Total Members",
    value: "1,284",
    delta: 12.4,
    deltaLabel: "vs last month",
    series: [38, 41, 40, 46, 52, 58, 63, 71],
  },
  {
    label: "Active Enrollments",
    value: "2,106",
    delta: 8.1,
    deltaLabel: "vs last month",
    series: [120, 128, 132, 140, 151, 160, 172, 186],
  },
  {
    label: "Avg. Completion",
    value: "61%",
    delta: 3.6,
    deltaLabel: "vs last month",
    series: [48, 50, 52, 54, 55, 57, 59, 61],
  },
  {
    label: "Quiz Pass Rate",
    value: "84%",
    delta: -1.2,
    deltaLabel: "vs last month",
    series: [88, 87, 86, 85, 86, 85, 84, 84],
  },
]

export const enrollmentTrend: TrendPoint[] = [
  { label: "Oct", value: 142 },
  { label: "Nov", value: 168 },
  { label: "Dec", value: 196 },
  { label: "Jan", value: 254 },
  { label: "Feb", value: 312 },
  { label: "Mar", value: 358 },
  { label: "Apr", value: 401 },
  { label: "May", value: 472 },
]

export const enrollmentBySource: TrendPoint[] = [
  { label: "GoHighLevel", value: 1486 },
  { label: "Self-enroll", value: 402 },
  { label: "Admin", value: 158 },
  { label: "Manual", value: 60 },
]

export const completionFunnel: TrendPoint[] = [
  { label: "Enrolled", value: 2106 },
  { label: "Started", value: 1842 },
  { label: "50%+", value: 1290 },
  { label: "Completed", value: 1284 },
]

export const topCoursesByEngagement: TrendPoint[] = [
  { label: "7-Figure Agency Program", value: 842 },
  { label: "Client Acquisition Mastery", value: 514 },
  { label: "High-Ticket Sales System", value: 389 },
]
