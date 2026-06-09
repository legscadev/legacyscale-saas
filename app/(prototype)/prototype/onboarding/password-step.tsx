"use client"

import { useState } from "react"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/auth/password-input"

interface PasswordStepProps {
  onSuccess: () => void
}

/**
 * Prototype-only password step. No validation — submitting just
 * advances the wizard. The real onboarding flow enforces strength
 * rules + a server round-trip; prototype skips both so anyone clicking
 * through the demo can move on without thinking about it.
 */
export function PasswordStep({ onSuccess }: PasswordStepProps) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSuccess()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create a password
        </h1>
        <p className="text-sm text-muted-foreground">
          You&apos;ll use this to sign in next time.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            name="password"
            placeholder="••••••••"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput
            id="confirm"
            name="confirm"
            placeholder="••••••••"
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
          />
        </div>

        <Button type="submit" className="w-full" size="lg">
          Set password and continue
          <ArrowRight />
        </Button>
      </form>
    </div>
  )
}
