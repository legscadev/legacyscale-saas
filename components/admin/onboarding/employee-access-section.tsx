'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  Ban,
  Check,
  Loader2,
  Search,
  UserPlus,
  X,
} from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  EMPLOYEE_ACCESS_ROLE_LABELS,
  type EmployeeAccessRoleValue,
} from '@/lib/validations/employee'
import type { LinkableUser } from '@/lib/services/employee-service'

import { searchLinkableUsersAction } from '@/app/(admin)/admin/onboarding/actions'

/** Local mode of the access section. `none` = no SaaS link, HR record
 *  only. `link` = attach an existing User. `create` = provision a
 *  fresh account. */
export type AccessMode = 'none' | 'link' | 'create'

export interface AccessState {
  mode: AccessMode
  /** Populated only when mode = 'link'. */
  linkedUser: LinkableUser | null
  /** Populated only when mode = 'create'. */
  email: string
  accessRole: EmployeeAccessRoleValue
}

export const INITIAL_ACCESS: AccessState = {
  mode: 'none',
  linkedUser: null,
  email: '',
  accessRole: 'TEAM',
}

interface EmployeeAccessSectionProps {
  state: AccessState
  onChange: (next: AccessState) => void
  disabled?: boolean
}

const DEBOUNCE_MS = 250

export function EmployeeAccessSection({
  state,
  onChange,
  disabled,
}: EmployeeAccessSectionProps) {
  const enabled = state.mode !== 'none'

  function setEnabled(next: boolean) {
    onChange(next ? { ...state, mode: 'link' } : { ...INITIAL_ACCESS })
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 rounded border-input"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={disabled}
        />
        <span>
          <span className="font-medium">Can access the system</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Link an existing user or create a new account.
          </span>
        </span>
      </label>

      {enabled ? (
        state.mode === 'create' ? (
          <CreateSubForm
            state={state}
            onChange={onChange}
            disabled={disabled}
          />
        ) : (
          <LinkSubForm state={state} onChange={onChange} disabled={disabled} />
        )
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------
// Link existing user
// ---------------------------------------------------------------------

function LinkSubForm({
  state,
  onChange,
  disabled,
}: {
  state: AccessState
  onChange: (next: AccessState) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LinkableUser[]>([])
  const [showResults, setShowResults] = useState(false)
  const [pending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const linked = state.linkedUser

  // Debounced search — a fresh transition per keystroke would slam
  // the server. 250ms is short enough to feel live and long enough
  // to coalesce most bursty typing. All state writes happen inside
  // the timeout callback (post-async), never synchronously in the
  // effect body — that's what react-hooks/purity requires.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
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
  }, [query])

  function pick(user: LinkableUser) {
    if (user.isAlreadyLinked) return
    onChange({ ...state, mode: 'link', linkedUser: user })
    setQuery('')
    setShowResults(false)
  }

  function unlink() {
    onChange({ ...state, mode: 'link', linkedUser: null })
    setQuery('')
    setShowResults(true)
  }

  function switchToCreate() {
    onChange({ ...INITIAL_ACCESS, mode: 'create' })
  }

  return (
    <div className="space-y-3 pl-6">
      {linked ? (
        <div className="flex items-center justify-between rounded-md border bg-background p-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {linked.name || linked.email}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {linked.email} · {linked.role.toLowerCase()}
            </p>
          </div>
          <button
            type="button"
            className="grid size-7 place-items-center rounded text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            onClick={unlink}
            disabled={disabled}
            aria-label="Change user"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="employee-user-search">Find existing user</Label>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="employee-user-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShowResults(true)
              }}
              onFocus={() => setShowResults(true)}
              placeholder="Search name or email"
              autoComplete="off"
              disabled={disabled}
              className="pl-8"
            />
            {pending ? (
              <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          {showResults && (query.trim() || results.length > 0) ? (
            <div className="mt-1 overflow-hidden rounded-md border bg-background shadow-sm">
              <ul className="max-h-56 overflow-y-auto">
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
                {!pending && query.trim() && results.length === 0 ? (
                  <li className="px-2.5 py-2 text-xs text-muted-foreground">
                    No matches
                  </li>
                ) : null}
                <li className="border-t bg-muted/40">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted"
                    onClick={switchToCreate}
                    disabled={disabled}
                  >
                    <UserPlus className="size-3.5" />
                    Create new user instead…
                  </button>
                </li>
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------
// Create new user
// ---------------------------------------------------------------------

function CreateSubForm({
  state,
  onChange,
  disabled,
}: {
  state: AccessState
  onChange: (next: AccessState) => void
  disabled?: boolean
}) {
  function switchToLink() {
    onChange({ ...INITIAL_ACCESS, mode: 'link' })
  }

  return (
    <div className="space-y-3 pl-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Creates a new account and emails an invite link.
        </p>
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
          onClick={switchToLink}
          disabled={disabled}
        >
          Link existing instead
        </button>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="employee-email">Login email</Label>
        <Input
          id="employee-email"
          type="email"
          value={state.email}
          onChange={(e) => onChange({ ...state, email: e.target.value })}
          placeholder="jane@company.com"
          required
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Access level</Label>
        <div
          role="radiogroup"
          aria-label="Access level"
          className="grid grid-cols-2 gap-2"
        >
          {(
            Object.keys(EMPLOYEE_ACCESS_ROLE_LABELS) as EmployeeAccessRoleValue[]
          ).map((r) => {
            const active = state.accessRole === r
            return (
              <label
                key={r}
                className={cn(
                  'flex cursor-pointer flex-col rounded-md border bg-background p-2.5 text-sm transition-colors',
                  active
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/40',
                  disabled && 'cursor-not-allowed opacity-60',
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="access-role"
                    value={r}
                    checked={active}
                    onChange={() => onChange({ ...state, accessRole: r })}
                    disabled={disabled}
                    className="size-3.5"
                  />
                  <span className="font-medium">
                    {EMPLOYEE_ACCESS_ROLE_LABELS[r]}
                  </span>
                </span>
                <span className="mt-1 pl-5 text-xs text-muted-foreground">
                  {r === 'ADMIN'
                    ? 'Full admin surface'
                    : 'Internal team; no admin console'}
                </span>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
