import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "../../../../button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../../../input-group"
import { Select } from "../../../../select"
import { ItemRow } from "../../../primitives/item-row"
import { addUnique } from "./settings-mappers"
import type { ChatResourceInfo } from "../../../../../lib/pi/chat-protocol"

export function resourceOptionValue(item: ChatResourceInfo) {
  // `name` is required on ChatResourceInfo, so this never trims undefined.
  return (item.source ?? item.path ?? item.workspacePath ?? item.name).trim()
}

/**
 * List editor that prefers Select when catalog entries exist (e.g. detected
 * agent-workspace skills). Existing values are always ItemRows; free-text is
 * only for adding when no catalog options remain.
 */
export function CatalogValueList({
  addLabel,
  catalog,
  onChange,
  placeholder,
  values,
}: {
  addLabel: string
  catalog: Array<ChatResourceInfo>
  onChange: (values: Array<string>) => void
  placeholder?: string
  values: Array<string>
}) {
  const [custom, setCustom] = useState("")

  const options = catalog
    .map((item) => {
      const value = resourceOptionValue(item)
      return {
        value,
        label: item.name || value,
      }
    })
    .filter(
      (option, index, all) =>
        option.value.length > 0 &&
        all.findIndex((entry) => entry.value === option.value) === index
    )

  const labelByValue = new Map(
    options.map((option) => [option.value, option.label])
  )
  const available = options.filter((option) => !values.includes(option.value))

  const addCustom = () => {
    const trimmed = custom.trim()
    if (!trimmed) return
    onChange(addUnique(values, trimmed))
    setCustom("")
  }

  return (
    <div className="flex flex-col gap-1.5">
      {values.length === 0 ? (
        <p className="px-1 py-2 text-xs text-pretty text-muted-foreground">
          Nothing selected yet.
        </p>
      ) : (
        values.map((value) => (
          <ItemRow
            key={value}
            interactive={false}
            title={labelByValue.get(value) ?? value}
            subtitle={
              labelByValue.has(value) && labelByValue.get(value) !== value
                ? value
                : undefined
            }
            trailing={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Remove ${value}`}
                onClick={() =>
                  onChange(values.filter((entry) => entry !== value))
                }
              >
                <Trash2 />
              </Button>
            }
          />
        ))
      )}

      {available.length > 0 ? (
        <Select
          aria-label={addLabel}
          value=""
          placeholder={addLabel}
          options={available}
          onValueChange={(next) => {
            if (!next) return
            onChange(addUnique(values, next))
          }}
        />
      ) : (
        <InputGroup>
          <InputGroupInput
            aria-label={addLabel}
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                addCustom()
              }
            }}
            placeholder={placeholder}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton onClick={addCustom} disabled={!custom.trim()}>
              <Plus data-icon="inline-start" />
              Add
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      )}
    </div>
  )
}
