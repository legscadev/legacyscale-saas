import { cn } from "@/lib/utils"

interface PageContainerProps {
  children: React.ReactNode
  className?: string
  /** Use a wider canvas for builder/analytics screens. */
  size?: "default" | "wide"
  /** Play the page fade-in on mount. Disable where the page re-mounts often
   *  (e.g. the lesson player switching lessons). */
  animate?: boolean
}

/** Consistent page padding + max width across all prototype screens. */
export function PageContainer({
  children,
  className,
  size = "default",
  animate = true,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 sm:px-6 lg:px-8",
        animate &&
          "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300",
        size === "wide" ? "max-w-[1400px]" : "max-w-6xl",
        className
      )}
    >
      {children}
    </div>
  )
}
