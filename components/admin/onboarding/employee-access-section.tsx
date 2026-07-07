'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  EMPLOYEE_ACCESS_ROLE_LABELS,
  type EmployeeAccessRoleValue,
} from '@/lib/validations/employee'

/**
 * Local state for the "create SaaS account" branch of add-employee.
 * We no longer track a "link existing" mode here — that's owned by
 * `EmployeeNameField`, which hides this whole section when a user
 * has been linked.
 */
export interface AccessState {
  enabled: boolean
  email: string
  accessRole: EmployeeAccessRoleValue
}

export const INITIAL_ACCESS: AccessState = {
  enabled: false,
  email: '',
  accessRole: 'TEAM',
}

interface EmployeeAccessSectionProps {
  state: AccessState
  onChange: (next: AccessState) => void
  disabled?: boolean
}

export function EmployeeAccessSection({
  state,
  onChange,
  disabled,
}: EmployeeAccessSectionProps) {
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 rounded border-input"
          checked={state.enabled}
          onChange={(e) => onChange({ ...state, enabled: e.target.checked })}
          disabled={disabled}
        />
        <span>
          <span className="font-medium">Can access the system</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Creates a new account and emails an invite link.
          </span>
        </span>
      </label>

      {state.enabled ? (
        <div className="space-y-3 pl-6">
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
                Object.keys(
                  EMPLOYEE_ACCESS_ROLE_LABELS,
                ) as EmployeeAccessRoleValue[]
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
      ) : null}
    </div>
  )
}
