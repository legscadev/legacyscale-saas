import Link from "next/link"
import { LifeBuoy, ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { BrandMark } from "@/components/prototype/shell/brand-mark"

export default function AccessRevoked() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="absolute top-6 left-6">
        <BrandMark />
      </div>

      <div className="flex max-w-md flex-col items-center text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-error/10 text-error">
          <ShieldAlert className="size-7" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          Your access has been revoked
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account no longer has access to the platform. If you believe
          this is a mistake, our team is happy to help sort it out.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button render={<Link href="/prototype/member/help" />}>
            <LifeBuoy />
            Contact support
          </Button>
          <Button
            variant="outline"
            render={<Link href="/prototype/auth/sign-in" />}
          >
            Back to sign in
          </Button>
        </div>
      </div>
    </div>
  )
}
