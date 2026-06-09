import { Monitor, Moon, Palette, Sun } from "lucide-react"
import { Button } from "../../../../button"
import { cn } from "../../../../../lib/utils"
import { ConfigurationSection } from "../shared/fields"
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
      ? "shadow-[0_0_15px_rgba(245,158,11,0.08)] border-amber-500/10"
      : themePreference === "dark"
        ? "shadow-[0_0_15px_rgba(139,92,246,0.08)] border-violet-500/10"
        : "shadow-[0_0_15px_rgba(100,116,139,0.08)] border-slate-500/10"

  return (
    <ConfigurationSection icon={Palette} label="Personalization">
      <div
        className={cn(
          "space-y-3 rounded-[10px] border border-border/30 bg-background/30 p-3.5 shadow-md backdrop-blur-md transition-all duration-300",
          haloColor
        )}
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="shrink-0 rounded-md border border-border/20 bg-foreground/5 p-1 text-foreground/50 shadow-sm">
            <Palette className="h-3.5 w-3.5 text-foreground/60" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold tracking-wide text-foreground/80">
              Interface Customization
            </div>
            <p className="mt-0.5 text-[10.5px] leading-relaxed text-foreground/45">
              Personalize theme preference settings. System preference
              coordinates with host browser rendering.
            </p>
          </div>
        </div>

        <div className="relative flex rounded-[8px] border border-border/10 bg-foreground/5 p-0.5">
          <ThemeSegment
            active={themePreference === "light"}
            icon={Sun}
            label="Light"
            activeGlow="border-primary/20 bg-background text-primary shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
            onClick={() => onThemePreferenceChange("light")}
          />
          <ThemeSegment
            active={themePreference === "dark"}
            icon={Moon}
            label="Dark"
            activeGlow="border-primary/20 bg-background text-primary shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
            onClick={() => onThemePreferenceChange("dark")}
          />
          <ThemeSegment
            active={themePreference === "system"}
            icon={Monitor}
            label="System"
            activeGlow="border-primary/20 bg-background text-primary shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
            onClick={() => onThemePreferenceChange("system")}
          />
        </div>
      </div>
    </ConfigurationSection>
  )
}

function ThemeSegment({
  active,
  icon: Icon,
  label,
  activeGlow,
  onClick,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  activeGlow: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={active ? "outline" : "ghost"}
      size="sm"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-7 min-w-0 flex-1 cursor-pointer justify-center gap-1.5 rounded-[6px] border-transparent px-2 text-[10.5px] font-bold shadow-none transition-all duration-300",
        active
          ? activeGlow
          : "text-foreground/40 hover:bg-transparent hover:text-foreground/65"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </Button>
  )
}
