'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MemberCourseCard } from './course-card'
import type { MemberCatalogCourse } from '@/lib/services/member-course-service'

interface CourseRowProps {
  title: string
  subtitle?: string
  courses: MemberCatalogCourse[]
}

// Each card slot — fixed width so the row scrolls horizontally and
// every tile has the same footprint regardless of title/description
// length.
const CARD_WIDTH = 280

export function CourseRow({ title, subtitle, courses }: CourseRowProps) {
  const scrollerRef = useRef<HTMLUListElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateArrowState = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 8)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
  }, [])

  useEffect(() => {
    updateArrowState()
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener('scroll', updateArrowState, { passive: true })
    const ro = new ResizeObserver(updateArrowState)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateArrowState)
      ro.disconnect()
    }
  }, [updateArrowState, courses.length])

  const scrollBy = (direction: 'left' | 'right') => {
    const el = scrollerRef.current
    if (!el) return
    // Page by roughly one full viewport of cards so swipes feel
    // intentional rather than nudging one tile at a time.
    const distance = Math.max(el.clientWidth - CARD_WIDTH / 2, CARD_WIDTH)
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    })
  }

  if (courses.length === 0) return null

  return (
    <section className="group/row space-y-3">
      <div className="flex items-end justify-between gap-4 px-1">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {courses.length} {courses.length === 1 ? 'course' : 'courses'}
        </span>
      </div>

      <div className="relative">
        <ArrowButton
          direction="left"
          visible={canScrollLeft}
          onClick={() => scrollBy('left')}
        />
        <ArrowButton
          direction="right"
          visible={canScrollRight}
          onClick={() => scrollBy('right')}
        />

        <ul
          ref={scrollerRef}
          className={cn(
            'flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2',
            // Hide the native scrollbar — arrow buttons + swipe carry
            // the affordance.
            '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
            // Inset padding so card hover transforms aren't clipped by
            // the overflow container.
            'px-1 -mx-1',
          )}
        >
          {courses.map((course, i) => (
            <li
              key={course.id}
              style={{ width: `${CARD_WIDTH}px` }}
              className="shrink-0 snap-start"
            >
              <MemberCourseCard course={course} index={i} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function ArrowButton({
  direction,
  visible,
  onClick,
}: {
  direction: 'left' | 'right'
  visible: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onClick}
      tabIndex={visible ? 0 : -1}
      aria-label={direction === 'left' ? 'Scroll left' : 'Scroll right'}
      aria-hidden={!visible}
      className={cn(
        // Pinned to the row edges, vertically centered on the card.
        'absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 rounded-full bg-background/90 shadow-md backdrop-blur',
        'md:flex',
        direction === 'left' ? '-left-4' : '-right-4',
        // Reveal on row hover or when keyboard focus is inside the
        // row; fade out when there's nothing to scroll toward.
        'pointer-events-none opacity-0 transition-opacity duration-200',
        visible &&
          'group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100',
      )}
    >
      {direction === 'left' ? <ChevronLeft /> : <ChevronRight />}
    </Button>
  )
}
