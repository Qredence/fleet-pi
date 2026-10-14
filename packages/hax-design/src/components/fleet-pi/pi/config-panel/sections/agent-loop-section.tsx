import { useState } from "react"
import { Input } from "../../../../input"
import { Select } from "../../../../select"
import { Switch } from "../../../../switch"
import { ItemRow } from "../../../primitives/item-row"
import type {
  ChatDeliveryMode,
  ChatPiSettings,
  ChatPiSettingsUpdate,
  ChatThinkingLevel,
} from "@workspace/pi-protocol/chat-protocol"

const THINKING_OPTIONS: Array<{ value: ChatThinkingLevel; label: string }> = [
  { value: "off", label: "Off" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
  { value: "max", label: "Max" },
]

const DELIVERY_OPTIONS: Array<{ value: ChatDeliveryMode; label: string }> = [
  { value: "all", label: "All" },
  { value: "one-at-a-time", label: "One at a time" },
]

export function AgentLoopSection({
  onSave,
  saving,
  settings,
}: {
  onSave: (update: ChatPiSettingsUpdate) => Promise<void>
  saving: boolean
  settings: ChatPiSettings | null
}) {
  const disabled = !settings || saving
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-medium">Agent loop</h3>
        <p className="text-sm text-muted-foreground">
          Compaction, retry, thinking, and queue behavior for the next hosted
          turn.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <ItemRow
          title="Compaction"
          subtitle="Summarize context before the window fills."
          trailing={
            <Switch
              aria-label="Compaction"
              checked={settings?.compaction.enabled ?? false}
              disabled={disabled}
              onCheckedChange={(checked) =>
                void onSave({
                  compaction: { enabled: checked === true },
                })
              }
            />
          }
        />
        <NumberRow
          disabled={disabled}
          label="Reserve tokens"
          value={settings?.compaction.reserveTokens}
          onCommit={(reserveTokens) =>
            onSave({ compaction: { reserveTokens } })
          }
        />
        <NumberRow
          disabled={disabled}
          label="Keep recent tokens"
          value={settings?.compaction.keepRecentTokens}
          onCommit={(keepRecentTokens) =>
            onSave({ compaction: { keepRecentTokens } })
          }
        />
        <NumberRow
          disabled={disabled}
          label="Background tokens"
          value={settings?.compaction.backgroundTokens ?? 0}
          onCommit={(backgroundTokens) =>
            onSave({ compaction: { backgroundTokens } })
          }
        />
        <ItemRow
          title="Retry"
          subtitle="Replay a failed generation up to the saved maximum."
          trailing={
            <Switch
              aria-label="Retry"
              checked={settings?.retry.enabled ?? false}
              disabled={disabled}
              onCheckedChange={(checked) =>
                void onSave({ retry: { enabled: checked === true } })
              }
            />
          }
        />
        <NumberRow
          disabled={disabled}
          label="Max retries"
          value={settings?.retry.maxRetries}
          onCommit={(maxRetries) => onSave({ retry: { maxRetries } })}
        />
        <NumberRow
          disabled={disabled}
          label="Retry delay (ms)"
          value={settings?.retry.baseDelayMs}
          onCommit={(baseDelayMs) => onSave({ retry: { baseDelayMs } })}
        />
        <NumberRow
          disabled={disabled}
          label="Max agent delay (ms)"
          value={settings?.retry.maxAgentDelayMs ?? 0}
          onCommit={(maxAgentDelayMs) => onSave({ retry: { maxAgentDelayMs } })}
        />
        <ItemRow
          title="Thinking"
          subtitle="Used when a new hosted conversation starts."
          trailing={
            <Select
              aria-label="Thinking level"
              className="w-[160px]"
              disabled={disabled}
              onValueChange={(value) =>
                void onSave({
                  defaultThinkingLevel: value as ChatThinkingLevel,
                })
              }
              options={THINKING_OPTIONS}
              value={settings?.defaultThinkingLevel ?? "off"}
            />
          }
        />
        <ItemRow
          title="Steering"
          subtitle="How steered prompts drain while a turn is busy."
          trailing={
            <Select
              aria-label="Steering mode"
              className="w-[160px]"
              disabled={disabled}
              onValueChange={(value) =>
                void onSave({ steeringMode: value as ChatDeliveryMode })
              }
              options={DELIVERY_OPTIONS}
              value={settings?.steeringMode ?? "all"}
            />
          }
        />
        <ItemRow
          title="Follow-up"
          subtitle="How queued follow-ups drain after the turn settles."
          trailing={
            <Select
              aria-label="Follow-up mode"
              className="w-[160px]"
              disabled={disabled}
              onValueChange={(value) =>
                void onSave({ followUpMode: value as ChatDeliveryMode })
              }
              options={DELIVERY_OPTIONS}
              value={settings?.followUpMode ?? "one-at-a-time"}
            />
          }
        />
        <ItemRow
          title="Code mode"
          subtitle="Off until you enable it. Plan mode never offers the tool."
          trailing={
            <Switch
              aria-label="Code mode"
              checked={settings?.codemode?.enabled ?? false}
              disabled={disabled}
              onCheckedChange={(checked) =>
                void onSave({
                  codemode: {
                    enabled: checked === true,
                    inlineBudget: settings?.codemode?.inlineBudget ?? 3000,
                  },
                })
              }
            />
          }
        />
        <NumberRow
          disabled={disabled}
          label="Code mode inline budget"
          value={settings?.codemode?.inlineBudget ?? 3000}
          onCommit={(inlineBudget) =>
            onSave({
              codemode: {
                enabled: settings?.codemode?.enabled ?? false,
                inlineBudget,
              },
            })
          }
        />
      </div>
    </div>
  )
}

function NumberRow({
  disabled,
  label,
  onCommit,
  value,
}: {
  disabled: boolean
  label: string
  onCommit: (value: number) => Promise<void>
  value: number | undefined
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value === undefined ? "" : String(value))
  return (
    <ItemRow
      title={label}
      trailing={
        <Input
          aria-label={label}
          className="w-[140px]"
          disabled={disabled}
          inputMode="numeric"
          onBlur={() => {
            const next = Number(shown)
            setDraft(null)
            if (!Number.isInteger(next) || next < 0 || next === value) return
            void onCommit(next)
          }}
          onChange={(event) => setDraft(event.target.value)}
          value={shown}
        />
      }
    />
  )
}
