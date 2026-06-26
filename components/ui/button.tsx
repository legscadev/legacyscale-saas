import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { Children, isValidElement } from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/30 [a]:hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ButtonExtraProps {
  /** When true, replaces the first SVG child with a spinner and
   *  disables the button. Keeps the existing text label intact so
   *  forms can swap their "Save" → "Saving…" copy independently. */
  loading?: boolean
}

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  nativeButton,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> &
  ButtonExtraProps) {
  // When loading, swap a spinner in. If the first child is an
  // element (the leading icon convention used across the app — e.g.
  // `<Button><Save /> Save changes</Button>`), the spinner *replaces*
  // it. Otherwise the spinner is prepended.
  let renderedChildren = children
  if (loading) {
    const array = Children.toArray(children)
    const dropLeadingIcon = array.length > 0 && isValidElement(array[0])
    renderedChildren = (
      <>
        <Loader2 className="animate-spin" />
        {dropLeadingIcon ? array.slice(1) : array}
      </>
    )
  }
  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading || undefined}
      render={render}
      // When rendering a custom element (e.g. a Next.js <Link>/<a>), it is no
      // longer a native <button>, so disable that assumption to keep correct
      // semantics and silence Base UI's nativeButton warning.
      nativeButton={nativeButton ?? (render ? false : undefined)}
      className={cn(
        buttonVariants({ variant, size, className }),
        loading && "cursor-wait",
      )}
      disabled={disabled || loading}
      {...props}
    >
      {renderedChildren}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
