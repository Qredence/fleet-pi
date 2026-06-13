import { cn } from "../../../lib/utils"
import {
  FIELD_LABEL_CLASS,
  fleetPiRowSurface,
  fleetPiSectionSurface,
} from "../styles/tokens"
import type { ComponentPropsWithoutRef, ReactNode } from "react"
import type { VariantProps } from "class-variance-authority"

type SectionSurfaceProps = ComponentPropsWithoutRef<"div"> &
  VariantProps<typeof fleetPiSectionSurface>

export function SectionSurface({
  className,
  dirty,
  elevation,
  padding,
  ...props
}: SectionSurfaceProps) {
  return (
    <div
      className={cn(
        fleetPiSectionSurface({ dirty, elevation, padding }),
        className
      )}
      {...props}
    />
  )
}

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

export function FieldLabel({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <label className="block space-y-1">
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      {children}
    </label>
  )
}

export function InlineNotice({ children }: { children: ReactNode }) {
  return (
    <RowSurface
      tone="muted"
      padding="lg"
      className="items-start gap-2.5 text-[10px] leading-normal text-foreground/50"
    >
      {children}
    </RowSurface>
  )
}
