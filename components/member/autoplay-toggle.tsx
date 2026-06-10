'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { useAutoplayPreference } from '@/hooks/use-autoplay-preference'

export function AutoplayToggle() {
  const { enabled, ready, setEnabled } = useAutoplayPreference()

  return (
    <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
      <Checkbox
        checked={ready ? enabled : true}
        onCheckedChange={(value) => setEnabled(value === true)}
        aria-label="Autoplay next lesson"
      />
      Autoplay next lesson
    </label>
  )
}
