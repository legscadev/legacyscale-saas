import type { Chapter, Course, QuizQuestion } from "./types"

const module1Quiz: QuizQuestion[] = [
  {
    id: "q1",
    questionText: "What is the primary focus of a 7-figure agency?",
    type: "MULTIPLE_CHOICE",
    options: [
      "Competing on the lowest price",
      "Winning a high volume of small clients",
      "Serving fewer, high-ticket clients",
      "Outsourcing everything cheaply",
    ],
    correctIndex: 2,
    explanation:
      "7-figure agencies win by serving fewer, high-value clients with " +
      "premium outcomes — not by racing to the bottom on price.",
  },
  {
    id: "q2",
    questionText: "Marketing fulfillment arbitrage is a valid business model.",
    type: "TRUE_FALSE",
    options: ["True", "False"],
    correctIndex: 0,
    explanation:
      "Charging a premium retainer while fulfilling efficiently is a core " +
      "lever of agency profitability.",
  },
  {
    id: "q3",
    questionText: "Which metric matters most when scaling delivery?",
    type: "MULTIPLE_CHOICE",
    options: [
      "Vanity follower count",
      "Net revenue retention",
      "Number of logos on the website",
      "Hours worked per week",
    ],
    correctIndex: 1,
    explanation:
      "Net revenue retention proves clients stay and expand — the engine " +
      "of durable, compounding agency growth.",
  },
]

const flagshipChapters: Chapter[] = [
  {
    id: "ch-1",
    courseId: "course-1",
    title: "Getting Started",
    orderIndex: 0,
    lessons: [
      {
        id: "l-1",
        chapterId: "ch-1",
        title: "Welcome to the Program",
        type: "VIDEO",
        status: "READY",
        orderIndex: 0,
        description: "The 7-figure roadmap and how to get the most from this program.",
        durationSeconds: 480,
        completed: true,
        watchedPercent: 100,
      },
      {
        id: "l-2",
        chapterId: "ch-1",
        title: "Setting Your Foundation",
        type: "VIDEO",
        status: "READY",
        orderIndex: 1,
        description: "Positioning, niche, and the offer that commands premium fees.",
        durationSeconds: 840,
        completed: true,
        watchedPercent: 100,
      },
      {
        id: "l-3",
        chapterId: "ch-1",
        title: "Module 1 Quiz",
        type: "QUIZ",
        status: "READY",
        orderIndex: 2,
        description: "Check your understanding of the agency fundamentals.",
        passingScore: 70,
        maxAttempts: 3,
        timeLimitMin: 10,
        questions: module1Quiz,
        completed: true,
      },
      {
        id: "l-4",
        chapterId: "ch-1",
        title: "Agency Starter Kit",
        type: "RESOURCE",
        status: "READY",
        orderIndex: 3,
        description: "Templates, contracts, and SOPs to launch fast.",
        resourceName: "agency-starter-kit.pdf",
        resourceSize: 2_412_544,
        completed: true,
      },
    ],
  },
  {
    id: "ch-2",
    courseId: "course-1",
    title: "Client Acquisition",
    orderIndex: 1,
    lessons: [
      {
        id: "l-5",
        chapterId: "ch-2",
        title: "Finding High-Ticket Clients",
        type: "VIDEO",
        status: "READY",
        orderIndex: 0,
        description: "Where premium clients actually look — and how to be found.",
        durationSeconds: 1320,
        completed: false,
        watchedPercent: 60,
        lastPositionSec: 792,
      },
      {
        id: "l-6",
        chapterId: "ch-2",
        title: "Cold Outreach That Converts",
        type: "VIDEO",
        status: "READY",
        orderIndex: 1,
        description: "A messaging framework that books calls without being spammy.",
        durationSeconds: 1080,
      },
      {
        id: "l-7",
        chapterId: "ch-2",
        title: "Module 2 Quiz",
        type: "QUIZ",
        status: "READY",
        orderIndex: 2,
        description: "Test your acquisition fundamentals.",
        passingScore: 70,
        maxAttempts: 3,
        timeLimitMin: 10,
        questions: module1Quiz,
      },
    ],
  },
  {
    id: "ch-3",
    courseId: "course-1",
    title: "Sales & Closing",
    orderIndex: 2,
    lessons: [
      {
        id: "l-8",
        chapterId: "ch-3",
        title: "The High-Ticket Sales Call",
        type: "VIDEO",
        status: "READY",
        orderIndex: 0,
        description: "A repeatable call structure that closes premium retainers.",
        durationSeconds: 1620,
      },
      {
        id: "l-9",
        chapterId: "ch-3",
        title: "Handling Objections",
        type: "VIDEO",
        status: "PROCESSING",
        orderIndex: 1,
        description: "Turn the four most common objections into commitments.",
        durationSeconds: 900,
      },
      {
        id: "l-10",
        chapterId: "ch-3",
        title: "Sales Scripts Pack",
        type: "RESOURCE",
        status: "READY",
        orderIndex: 2,
        description: "Word-for-word scripts for outreach, calls, and follow-up.",
        resourceName: "sales-scripts-pack.pdf",
        resourceSize: 1_048_576,
      },
    ],
  },
  {
    id: "ch-4",
    courseId: "course-1",
    title: "Scaling to 7-Figures",
    orderIndex: 3,
    lessons: [
      {
        id: "l-11",
        chapterId: "ch-4",
        title: "Hiring Your First Team",
        type: "VIDEO",
        status: "READY",
        orderIndex: 0,
        description: "The first three hires that buy back your time.",
        durationSeconds: 1200,
      },
      {
        id: "l-12",
        chapterId: "ch-4",
        title: "Systems & SOPs",
        type: "VIDEO",
        status: "READY",
        orderIndex: 1,
        description: "Document once, delegate forever.",
        durationSeconds: 1440,
      },
      {
        id: "l-13",
        chapterId: "ch-4",
        title: "Final Assessment",
        type: "QUIZ",
        status: "DRAFT",
        orderIndex: 2,
        description: "Prove mastery of the full 7-figure system.",
        passingScore: 80,
        maxAttempts: 2,
        questions: module1Quiz,
      },
    ],
  },
]

export const courses: Course[] = [
  {
    id: "course-1",
    title: "7-Figure Agency Program",
    description:
      "The complete training curriculum for building a 7-figure marketing " +
      "agency — from positioning and acquisition to sales, delivery, and scale.",
    status: "PUBLISHED",
    orderIndex: 0,
    accessDays: null,
    publishedAt: "2026-01-12",
    chapters: flagshipChapters,
    lessonCount: 13,
    durationMinutes: 198,
    enrollmentCount: 842,
    completionRate: 61,
  },
  {
    id: "course-2",
    title: "Client Acquisition Mastery",
    description:
      "A focused deep-dive on filling your pipeline with qualified, " +
      "high-ticket leads on demand.",
    status: "PUBLISHED",
    orderIndex: 1,
    accessDays: 365,
    publishedAt: "2026-02-03",
    chapters: [],
    lessonCount: 9,
    durationMinutes: 142,
    enrollmentCount: 514,
    completionRate: 48,
  },
  {
    id: "course-3",
    title: "High-Ticket Sales System",
    description:
      "The end-to-end sales process for consistently closing $5k–$25k/mo " +
      "retainers without discounting.",
    status: "PUBLISHED",
    orderIndex: 2,
    accessDays: null,
    publishedAt: "2026-03-18",
    chapters: [],
    lessonCount: 11,
    durationMinutes: 176,
    enrollmentCount: 389,
    completionRate: 39,
  },
  {
    id: "course-4",
    title: "Agency Operations & Scaling",
    description:
      "Build the team, systems, and SOPs that let your agency grow without " +
      "you in every detail.",
    status: "DRAFT",
    orderIndex: 3,
    accessDays: null,
    chapters: [],
    lessonCount: 7,
    durationMinutes: 121,
    enrollmentCount: 0,
    completionRate: 0,
  },
]

export const flagshipCourse = courses[0]

export function findCourse(id: string): Course | undefined {
  return courses.find((c) => c.id === id)
}

export function findLesson(id: string) {
  for (const course of courses) {
    for (const chapter of course.chapters) {
      const lesson = chapter.lessons.find((l) => l.id === id)
      if (lesson) return { course, chapter, lesson }
    }
  }
  return undefined
}

export const allFlagshipLessons = flagshipChapters.flatMap((c) => c.lessons)
