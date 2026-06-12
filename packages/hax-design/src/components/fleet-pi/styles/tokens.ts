import { cva } from "class-variance-authority"

/** Config panel and right-panel dense controls (12px text, 32px height). */
export const FIELD_CONTROL_CLASS =
  "h-8 rounded-[7px] border-border/50 bg-background/70 px-2 py-1.5 text-[12px] text-foreground/70 placeholder:text-foreground/25 focus-visible:border-foreground/25 focus-visible:ring-2 focus-visible:ring-foreground/10"

/** Small commit / add actions inside config sections. */
export const COMPACT_ACTION_BUTTON_CLASS =
  "h-8 shrink-0 cursor-pointer rounded-[7px] border-border/45 bg-background/65 text-[11px] font-semibold text-foreground/75 shadow-sm transition-all duration-150 hover:bg-foreground/5 disabled:opacity-50"

/** Floating header pills and inactive launcher chrome. */
export const CHROME_PILL_CLASS =
  "relative inline-flex h-9 items-center gap-1.5 rounded-full border border-border/70 px-3 text-[12px] font-medium whitespace-nowrap shadow-sm backdrop-blur transition-colors"

export const CHROME_PILL_INACTIVE_CLASS =
  "bg-sidebar text-foreground/55 hover:bg-background hover:text-foreground/75"

export const CHROME_PILL_ACTIVE_CLASS = "bg-background text-foreground/75"

/** Inline right-panel DiscreteTabs — matches header pill chrome. */
export const DISCRETE_TAB_INACTIVE_CLASS = CHROME_PILL_INACTIVE_CLASS

export const DISCRETE_TAB_ACTIVE_CLASS = CHROME_PILL_ACTIVE_CLASS

/** Chat shell header — above content row so tab tooltips can extend downward. */
export const CHAT_HEADER_LAYER_CLASS = "relative z-10 overflow-visible"

/** InputBar suggestion chips below the composer. */
export const SUGGESTION_LIST_CLASS = "!px-0 flex-col items-start gap-1.5"

export const SUGGESTION_ITEM_CLASS =
  "h-auto justify-start rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-foreground/65 shadow-sm transition-colors hover:border-border hover:bg-foreground/6 hover:text-foreground"

/** Mobile right-panel overlay sheet. */
export const PANEL_OVERLAY_CLASS =
  "h-full min-h-0 w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-[8px] border border-border/70 bg-background/95 shadow-lg backdrop-blur"

/** Uppercase field labels in configuration forms. */
export const FIELD_LABEL_CLASS =
  "text-[10px] font-bold tracking-wide text-foreground/45 uppercase"

export const fleetPiSectionSurface = cva(
  "space-y-3.5 rounded-[10px] border bg-background/30 backdrop-blur-md transition-all duration-300",
  {
    variants: {
      padding: {
        default: "p-3.5",
        compact: "p-3",
      },
      elevation: {
        default: "border-border/30 shadow-md",
        raised: "border-border/40 shadow-lg",
        quiet: "border-border/30 shadow-sm",
      },
      dirty: {
        true: "border-primary/30 shadow-[0_0_12px_rgba(0,0,0,0.05)]",
        false: "",
      },
    },
    defaultVariants: {
      padding: "default",
      elevation: "default",
      dirty: false,
    },
  }
)

export const fleetPiRowSurface = cva("flex min-w-0 rounded-[8px] border", {
  variants: {
    tone: {
      default: "border-border/30 bg-background/30",
      muted: "border-border/20 bg-foreground/1.5",
      inset: "border-border/60 bg-foreground/2",
      dashed: "border-dashed border-border/25 bg-background/10",
    },
    padding: {
      sm: "p-2",
      md: "px-2.5 py-2",
      lg: "p-2.5",
    },
    interactive: {
      true: "transition-all duration-200 hover:border-border/45 hover:bg-foreground/2 hover:shadow-sm",
      lift: "transition-all duration-200 hover:-translate-y-px hover:border-border/45 hover:bg-foreground/3.5 hover:shadow-sm",
      false: "",
    },
  },
  defaultVariants: {
    tone: "default",
    padding: "sm",
    interactive: false,
  },
})
