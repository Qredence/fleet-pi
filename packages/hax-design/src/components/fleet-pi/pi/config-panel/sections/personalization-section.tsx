import { Monitor, Moon, Palette, Sun } from "lucide-react"
import { Button } from "../../../../button"
import { cn } from "../../../../../lib/utils"
import { SectionSurface } from "../../../primitives/surface"
import type { ThemePreference } from "../../../../../lib/canvas-utils"
import type { LucideIcon } from "lucide-react"

export function PersonalizationSection({
  onThemePreferenceChange,
  themePreference,
}: {
  onThemePreferenceChange: (preference: ThemePreference) => void
  themePreference: ThemePreference
}) {
  const haloColor =
    themePreference === "light"
      ? "shadow-[0_0_15px_rgba(245,158,11,0.05)] border-amber-500/5 bg-background/20"
      : themePreference === "dark"
        ? "shadow-[0_0_15px_rgba(139,92,246,0.05)] border-violet-500/5 bg-background/20"
        : "shadow-[0_0_15px_rgba(100,116,139,0.05)] border-slate-500/5 bg-background/20"

  return (
    <SectionSurface
      className={cn("space-y-3.5 transition-all duration-300", haloColor)}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="shrink-0 rounded-lg border border-border/15 bg-foreground/5 p-1.5 text-foreground/50 shadow-sm transition-transform duration-300 hover:rotate-12">
          <Palette className="h-4 w-4 text-foreground/60" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold tracking-wide text-foreground/80">
            Interface Customization
          </div>
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-foreground/45">
            Personalize theme preference settings. System preference coordinates
            with host browser rendering.
          </p>
        </div>
      </div>

      <div className="relative z-0 flex overflow-hidden rounded-[8px] border border-border/10 bg-foreground/5 p-0.5">
        {/* Sliding Background Slider */}
        <div
          className={cn(
            "absolute top-0.5 bottom-0.5 z-[-1] w-[calc(33.333%-3px)] rounded-[6px] border border-border/20 bg-background shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            themePreference === "light" &&
              "left-0.5 shadow-[0_0_8px_rgba(245,158,11,0.1)]",
            themePreference === "dark" &&
              "left-[calc(33.333%+1px)] shadow-[0_0_8px_rgba(139,92,246,0.1)]",
            themePreference === "system" &&
              "left-[calc(66.666%+1px)] shadow-[0_0_8px_rgba(100,116,139,0.1)]"
          )}
        />
        <ThemeSegment
          active={themePreference === "light"}
          icon={Sun}
          label="Light"
          activeColor="text-amber-500 dark:text-amber-400 font-bold"
          iconClassName="group-hover:rotate-45"
          onClick={() => onThemePreferenceChange("light")}
        />
        <ThemeSegment
          active={themePreference === "dark"}
          icon={Moon}
          label="Dark"
          activeColor="text-violet-500 dark:text-violet-400 font-bold"
          iconClassName="group-hover:-rotate-12 group-hover:scale-110"
          onClick={() => onThemePreferenceChange("dark")}
        />
        <ThemeSegment
          active={themePreference === "system"}
          icon={Monitor}
          label="System"
          activeColor="text-primary font-bold"
          iconClassName="group-hover:translate-y-[-1px]"
          onClick={() => onThemePreferenceChange("system")}
        />
      </div>
    </SectionSurface>
  )
}

function ThemeSegment({
  active,
  icon: Icon,
  label,
  activeColor,
  iconClassName,
  onClick,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  activeColor: string
  iconClassName?: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "group h-7 min-w-0 flex-1 cursor-pointer justify-center gap-1.5 rounded-[6px] border-transparent bg-transparent px-2 text-[10.5px] shadow-none transition-all duration-250 hover:bg-transparent",
        active ? activeColor : "text-foreground/40 hover:text-foreground/75"
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-transform duration-300",
          iconClassName
        )}
      />
      <span className="truncate">{label}</span>
    </Button>
  )
}
