'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const STORAGE_KEY = 'theme'

interface ThemeToggleProps {
  /** When true, the button renders disabled with a "controlled by
   *  tenant palette" tooltip. Set by the shell when
   *  `Company.brand` is populated — at that point our inline CSS
   *  variables beat the `.dark` class so toggling would be a no-op. */
  locked?: boolean
}

/**
 * Toggles the `dark` class on <html> and persists the choice in
 * localStorage. The actual first-paint class is set by an inline
 * script in the root layout — see app/layout.tsx — so we only need to
 * mirror that state into React after mount.
 */
export function ThemeToggle({ locked = false }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggle = () => {
    if (locked) return
    const next = !isDark
    document.documentElement.classList.toggle('dark', next)
    setIsDark(next)
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
    } catch {
      // Storage might be unavailable (private mode, quota full) —
      // the in-memory toggle still works this session.
    }
  }

  const buttonLabel = locked
    ? 'Theme is set by the tenant palette'
    : isDark
      ? 'Switch to light mode'
      : 'Switch to dark mode'

  if (!locked) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggle}
        aria-label={buttonLabel}
      >
        {isDark ? <Moon /> : <Sun />}
      </Button>
    )
  }

  // Wrap in a non-disabled outer span so the tooltip can still fire
  // on hover — natively-disabled <button>s eat pointer events which
  // hides the tooltip from users trying to figure out why the
  // button isn't responding. Inner button is only visually disabled.
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            role="button"
            tabIndex={0}
            aria-disabled="true"
            aria-label={buttonLabel}
            className="inline-flex opacity-50 [&_button]:pointer-events-none"
          >
            <Button variant="ghost" size="icon-sm" tabIndex={-1}>
              {isDark ? <Moon /> : <Sun />}
            </Button>
          </span>
        }
      />
      <TooltipContent>
        Theme is set by the tenant palette — the light/dark toggle is
        disabled while a custom brand is active.
      </TooltipContent>
    </Tooltip>
  )
}
