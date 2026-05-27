import Link from "next/link"
import { ArrowRight, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BrandMark } from "@/components/prototype/shell/brand-mark"
import { PasswordInput } from "@/components/prototype/auth/password-input"

export default function SignInPage() {
  return (
    <div className="space-y-8">
      <BrandMark className="lg:hidden" />

      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to continue building your agency.
        </p>
      </div>

      <form className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="you@agency.com"
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/prototype/auth/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" placeholder="••••••••" />
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Checkbox defaultChecked />
          Keep me signed in
        </label>

        <Button
          className="w-full"
          size="lg"
          render={<Link href="/prototype/member/dashboard" />}
        >
          Sign in
          <ArrowRight />
        </Button>
      </form>

      <p className="border-t pt-6 text-center text-xs text-muted-foreground">
        Access is granted after enrollment. Need help getting in?{" "}
        <Link
          href="/prototype/member/help"
          className="font-medium text-primary hover:underline"
        >
          Contact support
        </Link>
      </p>
    </div>
  )
}
