'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Ban, Check, Loader2, Search, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { LinkableUser } from '@/lib/services/employee-service'

import { searchLinkableUsersAction } from '@/app/(admin)/admin/onboarding/actions'

interface EmployeeNameFieldProps {
  /** Free-text name typed by the admin. Used when no user is linked. */
  value: string
  onChange: (value: string) => void
  /** The user this Employee will be linked to, if any. */
  linkedUser: LinkableUser | null
  onLink: (user: LinkableUser) => void
  onUnlink: () => void
  disabled?: boolean
}

const DEBOUNCE_MS = 250

/**
 * Name input that doubles as a "link existing user" picker. As the
 * admin types, matching Users appear in a dropdown below. Picking one
 * swaps the field for a read-only chip; clicking the X clears the
 * link and returns to plain text entry. If the admin just types a
 * name without picking anyone, that name is used as-is for a fresh
 * Employee record.
 */
export function EmployeeNameField({
  value,
  onChange,
  linkedUser,
  onLink,
  onUnlink,
  disabled,
}: EmployeeNameFieldProps) {
  const [results, setResults] = useState<LinkableUser[]>([])
  const [showResults, setShowResults] = useState(false)
  const [pending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Debounced search — all state writes happen inside the timeout
  // callback (post-async) to satisfy react-hooks/purity.
  useEffect(() => {
    if (linkedUser) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = value.trim()
    debounceRef.current = setTimeout(() => {
      if (!q) {
        setResults([])
        return
      }
      startTransition(async () => {
        try {
          const rows = await searchLinkableUsersAction(q)
          setResults(rows)
        } catch {
          setResults([])
        }
      })
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, linkedUser])

  // Close the results dropdown when the click lands outside the
  // combobox. We can't rely on onBlur alone because clicking a
  // result would blur before the click handler fires.
  useEffect(() => {
    if (!showResults) return
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showResults])

  function pick(user: LinkableUser) {
    if (user.isAlreadyLinked) return
    onLink(user)
    setShowResults(false)
    setResults([])
  }

  if (linkedUser) {
    return (
      <div className="space-y-1.5">
        <Label>Name</Label>
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {(linkedUser.name || linkedUser.email).slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {linkedUser.name || linkedUser.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {linkedUser.email} · {linkedUser.role.toLowerCase()} · linked
            </p>
          </div>
          <button
            type="button"
            onClick={onUnlink}
            disabled={disabled}
            aria-label="Unlink user"
            className="grid size-7 place-items-center rounded text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    )
  }

  const q = value.trim()
  const showDropdown =
    showResults && (q.length > 0 || results.length > 0 || pending)

  return (
    <div className="space-y-1.5">
      <Label htmlFor="employee-name">Name</Label>
      <div ref={containerRef} className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="employee-name"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setShowResults(true)
          }}
          onFocus={() => setShowResults(true)}
          onKeyDown={(e) => {
            // Enter with the dropdown open should commit the typed
            // name as-is and dismiss the suggestions, NOT submit the
            // form. That matches the hint we show in the dropdown.
            if (e.key === 'Enter' && showResults) {
              e.preventDefault()
              setShowResults(false)
              setResults([])
              return
            }
            if (e.key === 'Escape' && showResults) {
              e.preventDefault()
              setShowResults(false)
            }
            // Tab keeps its default focus-move behaviour, but we
            // still want the dropdown to disappear so it doesn't
            // linger over the next field.
            if (e.key === 'Tab' && showResults) {
              setShowResults(false)
            }
          }}
          placeholder="Type a name or search existing users"
          autoComplete="off"
          required
          disabled={disabled}
          className="pl-8"
        />
        {pending ? (
          <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}

        {showDropdown ? (
          <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border bg-background shadow-md">
            <ul className="max-h-56 overflow-y-auto">
              {results.length > 0 ? (
                <>
                  <li className="border-b bg-muted/30 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Existing users
                  </li>
                  {results.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors',
                          u.isAlreadyLinked
                            ? 'cursor-not-allowed opacity-50'
                            : 'hover:bg-muted focus-visible:bg-muted',
                        )}
                        onClick={() => pick(u)}
                        disabled={disabled || u.isAlreadyLinked}
                      >
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-medium">
                          {(u.name || u.email).slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">
                            {u.name || u.email}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {u.email} · {u.role.toLowerCase()}
                          </span>
                        </span>
                        {u.isAlreadyLinked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            <Ban className="size-2.5" />
                            linked
                          </span>
                        ) : (
                          <Check className="size-3.5 text-transparent" />
                        )}
                      </button>
                    </li>
                  ))}
                </>
              ) : q && !pending ? (
                <li className="px-2.5 py-2 text-xs text-muted-foreground">
                  No existing users match &ldquo;{q}&rdquo;. Continue below to
                  add a new employee.
                </li>
              ) : null}
              {q ? (
                <li className="border-t bg-muted/30">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResults(false)
                      setResults([])
                    }}
                    disabled={disabled}
                    className="w-full px-2.5 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    Continue with &ldquo;
                    <span className="font-medium text-foreground">{q}</span>
                    &rdquo; as a new employee
                  </button>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
