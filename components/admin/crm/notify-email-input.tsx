'use client'

// Recipient search for lead notifications. Search existing team users by
// name OR email; picking one fills their email (and, via onPickUser, their
// phone). Or type any email for a non-user — the dropdown offers a
// "Custom" option so it's clear you're using a raw address, not a user.

import { useEffect, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'

import {
  listCrmNotifyUsersAction,
  type CrmNotifyUser,
} from '@/app/(admin)/admin/crm/opportunities/actions'

// Cache across mounts so every dialog doesn't re-fetch the roster.
let cachedUsers: CrmNotifyUser[] | null = null

interface NotifyEmailInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  /** Fired when a registered user is picked — lets the parent also fill
   *  a companion field (e.g. phone) from the user's contact. */
  onPickUser?: (user: CrmNotifyUser) => void
  onBlur?: () => void
  placeholder?: string
  /** Which contact field of a picked user becomes `value`. */
  pickFills?: 'email' | 'phone'
  /** Input type. Defaults to match pickFills (email→email, phone→tel). */
  type?: 'email' | 'tel'
}

export function NotifyEmailInput({
  id,
  value,
  onChange,
  onPickUser,
  onBlur,
  placeholder,
  pickFills = 'email',
  type,
}: NotifyEmailInputProps) {
  const [users, setUsers] = useState<CrmNotifyUser[]>(cachedUsers ?? [])
  const [open, setOpen] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (cachedUsers) {
      setUsers(cachedUsers)
      return
    }
    let active = true
    listCrmNotifyUsersAction().then((res) => {
      if (!res.ok) return
      cachedUsers = res.data
      if (active) setUsers(res.data)
    })
    return () => {
      active = false
    }
  }, [])

  const fieldOf = (u: CrmNotifyUser) =>
    pickFills === 'phone' ? (u.phone ?? '') : u.email

  const q = value.trim().toLowerCase()
  const matches = users
    .filter((u) => {
      if (!q) return true
      return (
        u.email.toLowerCase().includes(q) ||
        (u.name ?? '').toLowerCase().includes(q) ||
        (u.phone ?? '').toLowerCase().includes(q)
      )
    })
    // In phone mode, a teammate with no phone can't be picked.
    .filter((u) => (pickFills === 'phone' ? !!u.phone : true))
    .slice(0, 8)

  // Offer a "Custom" row when what's typed isn't an exact registered
  // user's value — signals "using a raw value, not a teammate".
  const isExactUser = users.some((u) => fieldOf(u).toLowerCase() === q)
  const showCustom = q.length > 0 && !isExactUser

  function pickUser(u: CrmNotifyUser) {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    onChange(fieldOf(u))
    onPickUser?.(u)
    setOpen(false)
  }

  function pickCustom() {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    onChange(value.trim())
    setOpen(false)
  }

  return (
    <div className="relative">
      <Input
        id={id}
        type={type ?? (pickFills === 'phone' ? 'tel' : 'email')}
        autoComplete="off"
        value={value}
        placeholder={placeholder ?? 'Search a teammate or type any email'}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => {
            setOpen(false)
            onBlur?.()
          }, 150)
        }}
      />
      {open && (matches.length > 0 || showCustom) ? (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {matches.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  pickUser(u)
                }}
                className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left hover:bg-accent"
              >
                <span className="text-sm font-medium">{u.name ?? u.email}</span>
                <span className="text-xs text-muted-foreground">
                  {u.email}
                  {u.phone ? ` · ${u.phone}` : ''}
                </span>
              </button>
            </li>
          ))}
          {showCustom ? (
            <li key="__custom">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  pickCustom()
                }}
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-accent"
              >
                <span className="truncate text-sm">
                  Use “{value.trim()}”
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Custom
                </span>
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
