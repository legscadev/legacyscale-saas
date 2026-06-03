"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      // `richColors` opts each type into its own bg / text / border slot;
      // we override Sonner's defaults so they pull from our design
      // tokens (--color-*, exposed by Tailwind 4's @theme block in
      // globals.css) instead of Sonner's hardcoded palette.
      richColors
      style={
        {
          "--normal-bg": "var(--color-popover)",
          "--normal-text": "var(--color-popover-foreground)",
          "--normal-border": "var(--color-border)",
          "--border-radius": "var(--radius)",
          // success
          "--success-bg":
            "color-mix(in oklab, var(--color-success) 12%, var(--color-popover))",
          "--success-text": "var(--color-success)",
          "--success-border":
            "color-mix(in oklab, var(--color-success) 30%, transparent)",
          // error
          "--error-bg":
            "color-mix(in oklab, var(--color-error) 12%, var(--color-popover))",
          "--error-text": "var(--color-error)",
          "--error-border":
            "color-mix(in oklab, var(--color-error) 30%, transparent)",
          // warning
          "--warning-bg":
            "color-mix(in oklab, var(--color-warning) 14%, var(--color-popover))",
          "--warning-text": "var(--color-warning)",
          "--warning-border":
            "color-mix(in oklab, var(--color-warning) 30%, transparent)",
          // info → primary brand
          "--info-bg":
            "color-mix(in oklab, var(--color-primary) 10%, var(--color-popover))",
          "--info-text": "var(--color-primary)",
          "--info-border":
            "color-mix(in oklab, var(--color-primary) 30%, transparent)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
