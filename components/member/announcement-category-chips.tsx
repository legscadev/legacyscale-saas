'use client'

import Link from 'next/link'

import { cn } from '@/lib/utils'
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  type AnnouncementCategory,
} from '@/lib/validations/announcement'

interface CategoryChipsProps {
  active: AnnouncementCategory | null
}

const CATEGORY_KEYS = Object.keys(ANNOUNCEMENT_CATEGORY_LABELS) as AnnouncementCategory[]

export function CategoryChips({ active }: CategoryChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip href="/announcements" label="All" active={active === null} />
      {CATEGORY_KEYS.map((key) => (
        <Chip
          key={key}
          href={`/announcements?category=${key}`}
          label={ANNOUNCEMENT_CATEGORY_LABELS[key]}
          active={active === key}
        />
      ))}
    </div>
  )
}

function Chip({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-muted/30 text-muted-foreground hover:border-foreground/20 hover:bg-muted/60',
      )}
    >
      {label}
    </Link>
  )
}
