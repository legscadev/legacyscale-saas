'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { SIDEBAR_COOKIE, SIDEBAR_COOKIE_MAX_AGE } from './sidebar-cookie'

interface SidebarContextValue {
  collapsed: boolean
  toggle: () => void
  setCollapsed: (value: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

interface SidebarProviderProps {
  /** Server-rendered initial state from the cookie. */
  defaultCollapsed?: boolean
  children: React.ReactNode
}

export function SidebarProvider({
  defaultCollapsed = false,
  children,
}: SidebarProviderProps) {
  const [collapsed, setCollapsedState] = useState(defaultCollapsed)

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value)
    if (typeof document !== 'undefined') {
      document.cookie = `${SIDEBAR_COOKIE}=${value ? '1' : '0'}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`
    }
  }, [])

  const toggle = useCallback(() => {
    setCollapsed(!collapsed)
  }, [collapsed, setCollapsed])

  // Cmd+B / Ctrl+B mirrors the shadcn sidebar shortcut.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle])

  const value = useMemo(
    () => ({ collapsed, toggle, setCollapsed }),
    [collapsed, toggle, setCollapsed],
  )

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  )
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    throw new Error('useSidebar must be used inside <SidebarProvider>')
  }
  return ctx
}
