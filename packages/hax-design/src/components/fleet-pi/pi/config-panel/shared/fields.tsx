import { Check, Info, Loader2, RotateCcw, Save } from "lucide-react"
import { Button } from "../../../../button"
import { Input } from "../../../../input"
import { Select } from "../../../../select"
import { Switch } from "../../../../switch"
import { Badge } from "../../../../badge"
import { cn } from "../../../../../lib/utils"
import {
  FieldLabel,
  RowSurface,
  SectionSurface,
} from "../../../primitives/surface"
import { fleetPiRowSurface } from "../../../styles/tokens"
import { FIELD_CONTROL_CLASS } from "./constants"
import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

export { FieldLabel }

export function EditableSection({
  children,
  dirty,
  disabled,
  onRevert,
  onSave,
  saving,
  title,
}: {
  children: ReactNode
  dirty: boolean
  disabled: boolean
  onRevert: () => void
  onSave: () => void
  saving: boolean
  title: string
}) {
  return (
    <SectionSurface dirty={dirty}>
      <div className="flex min-w-0 items-center gap-2.5 border-b border-border/10 pb-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-bold tracking-wide text-foreground/80">
            {title}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {dirty ? (
              <Badge variant="secondary" className="gap-1.5 shadow-sm">
                <span className="relative flex h-1 w-1">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foreground opacity-75"></span>
                  <span className="relative inline-flex h-1 w-1 rounded-full bg-foreground"></span>
                </span>
                Unsaved changes
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 border-primary/20 bg-primary/10 text-primary"
              >
                <Check className="h-2 w-2" />
                In sync
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-7 w-7 cursor-pointer rounded-[6px] p-0 text-foreground/35 transition-all duration-150 hover:bg-foreground/5 hover:text-foreground/65 disabled:opacity-35",
              !dirty && "hidden"
            )}
            disabled={!dirty || disabled || saving}
            onClick={onRevert}
            aria-label={`Revert ${title}`}
            title="Revert changes"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-7 cursor-pointer rounded-[6px] border-border/45 bg-background/50 px-2.5 text-[10px] font-bold text-foreground/60 shadow-sm transition-all duration-200 hover:bg-foreground/5 hover:text-foreground/80 disabled:opacity-40",
              dirty &&
                "border-primary/30 text-primary shadow-sm hover:bg-primary/5 hover:text-primary/90 active:scale-95"
            )}
            disabled={!dirty || disabled || saving}
            onClick={onSave}
          >
            {saving ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin text-foreground/50" />
                Saving
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Save className="h-3 w-3" />
                Commit
              </span>
            )}
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3.5">{children}</div>
    </SectionSurface>
  )
}

export function SelectField<T extends string>({
  label,
  onChange,
  value,
  values,
}: {
  label: string
  onChange: (value: T) => void
  value: T
  values: Array<T>
}) {
  return (
    <FieldLabel label={label}>
      <Select
        aria-label={label}
        value={value}
        onValueChange={(nextValue) => onChange(nextValue as T)}
        className={FIELD_CONTROL_CLASS}
        options={values.map((item) => ({ label: item, value: item }))}
      />
    </FieldLabel>
  )
}

export function NumberField({
  label,
  min,
  onChange,
  value,
}: {
  label: string
  min: number
  onChange: (value: number) => void
  value: number
}) {
  return (
    <FieldLabel label={label}>
      <Input
        type="number"
        min={min}
        value={value}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10)
          onChange(Number.isFinite(parsed) ? Math.max(min, parsed) : min)
        }}
        className={FIELD_CONTROL_CLASS}
      />
    </FieldLabel>
  )
}

export function ToggleField({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      className={cn(
        fleetPiRowSurface({
          tone: "default",
          padding: "md",
          interactive: true,
        }),
        "h-8.5 cursor-pointer items-center justify-between gap-3 bg-background/40 hover:bg-foreground/1.5"
      )}
    >
      <span className="truncate text-[11px] font-semibold text-foreground/65">
        {label}
      </span>
      <Switch
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="scale-90"
      />
    </label>
  )
}

export function InlineNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[8px] border border-border/15 bg-foreground/1.5 p-2.5 text-[10px] leading-normal text-foreground/50">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/40" />
      <span className="font-medium">{children}</span>
    </div>
  )
}

export function ConfigurationSection({
  children,
  icon: Icon,
  label,
}: {
  children: ReactNode
  icon: LucideIcon
  label: string
}) {
  return (
    <div className="py-1">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-medium tracking-normal text-foreground/35 uppercase">
        <Icon className="size-3" />
        <span>{label}</span>
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  )
}

export function ConfigurationRow({
  description,
  status,
  title,
}: {
  description: string
  status: string
  title: string
}) {
  return (
    <RowSurface tone="inset" padding="md" className="items-center gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-[12px] font-medium text-foreground/75">
            {title}
          </span>
          <span className="shrink-0 rounded-lg bg-foreground/5 px-1.5 py-0.5 text-[10px] text-foreground/35">
            {status}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-foreground/40">
          {description}
        </p>
      </div>
    </RowSurface>
  )
}
