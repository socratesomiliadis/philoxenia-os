import * as React from "react"
import { cn } from "cn"
import { controlDisabled, controlFocus, controlSurface } from "./control-styles"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-fixed min-h-16 w-full min-w-0 resize-y rounded-xl border p-3 text-sm leading-7 transition-colors outline-none placeholder:text-muted-foreground/70 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        controlSurface, controlFocus, controlDisabled,
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
