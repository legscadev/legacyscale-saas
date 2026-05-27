import { Clock, Wrench } from 'lucide-react'
import { Logo } from '@/components/layout/logo'

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-warning/10">
          <Wrench className="size-10 text-warning" />
        </div>

        <h1 className="mb-2 text-2xl font-bold tracking-tight">
          Under Maintenance
        </h1>
        <p className="mb-8 text-muted-foreground">
          We&apos;re performing scheduled maintenance to improve your
          experience. We&apos;ll be back shortly!
        </p>

        <div className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">
          <Clock className="size-4" />
          <span>Estimated downtime: 30 minutes</span>
        </div>
      </div>
    </div>
  )
}
