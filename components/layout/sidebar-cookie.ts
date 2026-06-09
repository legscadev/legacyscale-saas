// Cookie holds the desktop collapsed state across reloads so the
// initial server render matches what the user last left it on.
//
// Exported from a non-"use client" module so server components
// (layouts) can read the same constant the client provider uses to
// write it. Importing this name from a 'use client' module breaks on
// the server side (the import resolves to empty string), which is why
// the constant lives here and is re-used by sidebar-context.tsx.
export const SIDEBAR_COOKIE = 'sidebar-collapsed'

// One year — sidebar preference is sticky enough that re-prompting is
// just annoyance.
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
