import { cn } from "@/lib/utils"

/**
 * Skeleton placeholder. Default is the classic pulse; pass
 * `variant="shimmer"` for a premium left-to-right gradient sweep that
 * matches Linear / Vercel loading states.
 */
function Skeleton({
  className,
  variant = "shimmer",
  ...props
}: React.ComponentProps<"div"> & { variant?: "shimmer" | "pulse" }) {
  return (
    <div
      data-slot="skeleton"
      data-variant={variant}
      className={cn(
        "rounded-md bg-muted",
        variant === "pulse" && "animate-pulse",
        variant === "shimmer" &&
          // Shimmer sweep: a linear gradient overlay slides across.
          // Use a pseudo-element via mask-image trick for crisp edges.
          "relative overflow-hidden isolate before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r before:from-transparent before:via-foreground/[0.08] before:to-transparent dark:before:via-foreground/[0.12]",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
