import { cn } from "../../../lib/utils"
import { fleetPiRowSurface } from "../styles/tokens"

import type { VariantProps } from "class-variance-authority"
import type { ComponentPropsWithoutRef } from "react"

type RowSurfaceProps = ComponentPropsWithoutRef<"div"> &
  VariantProps<typeof fleetPiRowSurface>

export function RowSurface({
  className,
  interactive,
  padding,
  tone,
  ...props
}: RowSurfaceProps) {
  return (
    <div
      className={cn(
        fleetPiRowSurface({ interactive, padding, tone }),
        className
      )}
      {...props}
    />
  )
}
