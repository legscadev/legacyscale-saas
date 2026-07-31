'use client'

// Time-of-day greeting for the dashboard hero. Runs on the client
// so the greeting matches the viewer's local time (server-rendered
// would show whatever timezone the deploy region sits in).

import { useEffect, useState } from 'react'

const HOUR_BUCKETS: Array<[number, string]> = [
  [5, 'Good morning'],
  [12, 'Good afternoon'],
  [17, 'Good evening'],
]

function greetingFor(date: Date): string {
  const hour = date.getHours()
  let phrase = 'Hello'
  for (const [start, text] of HOUR_BUCKETS) {
    if (hour >= start) phrase = text
  }
  if (hour < 5) phrase = 'Still up' // <5am: cheeky night-owl copy
  return phrase
}

function firstName(fullName: string | null | undefined): string {
  if (!fullName) return 'there'
  const first = fullName.trim().split(/\s+/)[0]
  return first || 'there'
}

export function DashboardGreeting({
  name,
  subtitle,
}: {
  name: string | null
  subtitle: string
}) {
  // SSR fallback: neutral greeting → replaces after hydration so
  // there's no time-zone flicker on first paint.
  const [greeting, setGreeting] = useState('Hello')
  useEffect(() => {
    setGreeting(greetingFor(new Date()))
  }, [])
  return (
    <div className="space-y-1">
      <h1 className="text-3xl font-bold tracking-tight">
        {greeting}, {firstName(name)}
      </h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}
