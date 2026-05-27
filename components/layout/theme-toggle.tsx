'use client'

import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Toggles the `dark` class on <html>. The app ships dark-by-default
 * (set on the root layout), so this avoids a theme provider while still
 * staying correct across client navigation by reading the live DOM state.
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)

  const toggle = () => {
    const root = document.documentElement
    const next = !root.classList.contains('dark')
    root.classList.toggle('dark', next)
    setIsDark(next)
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Moon /> : <Sun />}
    </Button>
  )
}
