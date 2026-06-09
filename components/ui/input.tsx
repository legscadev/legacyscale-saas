import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // Layout + base
        "h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1.5 text-sm shadow-xs transition-all outline-none",
        // File input chrome
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        // Placeholder
        "placeholder:text-muted-foreground/70",
        // Focus — brand-tinted ring + soft glow
        "focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:shadow-sm focus-visible:shadow-primary/10",
        // Hover
        "hover:border-input/80",
        // Disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted/40 disabled:opacity-60",
        // Invalid
        "aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/15",
        // Dark mode
        "dark:bg-input/20 dark:hover:bg-input/30 dark:disabled:bg-input/40",
        "dark:aria-invalid:border-destructive/60 dark:aria-invalid:ring-destructive/30",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
