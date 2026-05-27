"use client"

import { useState } from "react"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Lightweight theme toggle for the prototype. Toggles the `dark` class on the
 * document root (the app ships dark-by-default); avoids a provider so it works
 * cleanly within the existing root layout. Reads the live DOM state on each
 * click so it stays correct even across client-side navigation.
 */
export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)

  const toggle = () => {
    const root = document.documentElement
    const next = !root.classList.contains("dark")
    root.classList.toggle("dark", next)
    setIsDark(next)
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Moon /> : <Sun />}
    </Button>
  )
}
