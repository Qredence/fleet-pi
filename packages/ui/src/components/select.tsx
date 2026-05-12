import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

export type SelectOption = {
  disabled?: boolean
  label: React.ReactNode
  value: string
}

type SelectProps = Omit<
  SelectPrimitive.Root.Props<string>,
  "children" | "items" | "onValueChange" | "value"
> & {
  "aria-label"?: string
  className?: string
  onValueChange: (value: string) => void
  options: Array<SelectOption>
  placeholder?: string
  value: string
}

function Select({
  className,
  onValueChange,
  options,
  placeholder,
  value,
  ...props
}: SelectProps) {
  const selected = options.find((option) => option.value === value)

  return (
    <SelectPrimitive.Root
      data-slot="select"
      items={options}
      onValueChange={(nextValue) => {
        if (nextValue !== null) {
          onValueChange(nextValue)
        }
      }}
      value={value}
      {...props}
    >
      <SelectPrimitive.Trigger
        aria-label={props["aria-label"]}
        className={cn(
          "flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 data-placeholder:text-muted-foreground dark:bg-input/30 dark:disabled:bg-input/80",
          className
        )}
      >
        <SelectPrimitive.Value>
          <span className="truncate">
            {selected?.label ?? placeholder ?? value}
          </span>
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon className="shrink-0 text-muted-foreground">
          <ChevronDown />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner className="z-50" sideOffset={4}>
          <SelectPrimitive.Popup className="max-h-72 min-w-(--anchor-width) overflow-y-auto rounded-lg border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <SelectPrimitive.List>
              {options.map((option) => (
                <SelectPrimitive.Item
                  className="relative flex min-h-7 cursor-default items-center rounded-md py-1.5 pr-2 pl-7 text-sm outline-none select-none data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                  disabled={option.disabled}
                  key={option.value}
                  value={option.value}
                >
                  <SelectPrimitive.ItemIndicator className="absolute left-2 flex items-center justify-center">
                    <Check />
                  </SelectPrimitive.ItemIndicator>
                  <SelectPrimitive.ItemText>
                    {option.label}
                  </SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export { Select }
