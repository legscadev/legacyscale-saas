'use client'

import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'

import { Input } from '@/components/ui/input'

interface PasswordInputProps {
  id?: string
  name?: string
  placeholder?: string
  required?: boolean
  autoComplete?: string
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  minLength?: number
}

export function PasswordInput({
  id,
  name,
  placeholder,
  required,
  autoComplete,
  defaultValue,
  value,
  onChange,
  minLength,
}: PasswordInputProps) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        minLength={minLength}
        className="px-8"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
