import { Wrench } from "lucide-react"
import { DELIVERY_MODES, TRANSPORTS } from "../shared/constants"
import {
  ConfigurationSection,
  EditableSection,
  NumberField,
  SelectField,
  ToggleField,
} from "../shared/fields"
import type {
  ChatDeliveryMode,
  ChatPiSettings,
  ChatTransport,
} from "../../../../../lib/pi/chat-protocol"

export function RuntimePolicySection({
  draft,
  onCompactionEnabledChange,
  onCompactionKeepRecentTokensChange,
  onCompactionReserveTokensChange,
  onFollowUpModeChange,
  onRetryBaseDelayMsChange,
  onRetryEnabledChange,
  onRetryMaxRetriesChange,
  onRevert,
  onSave,
  onSteeringModeChange,
  onTransportChange,
  runtimeDirty,
  saving,
  settingsLoading,
}: {
  draft: ChatPiSettings | null
  onCompactionEnabledChange: (enabled: boolean) => void
  onCompactionKeepRecentTokensChange: (tokens: number) => void
  onCompactionReserveTokensChange: (tokens: number) => void
  onFollowUpModeChange: (mode: ChatDeliveryMode) => void
  onRetryBaseDelayMsChange: (delayMs: number) => void
  onRetryEnabledChange: (enabled: boolean) => void
  onRetryMaxRetriesChange: (maxRetries: number) => void
  onRevert: () => void
  onSave: () => void
  onSteeringModeChange: (mode: ChatDeliveryMode) => void
  onTransportChange: (transport: ChatTransport) => void
  runtimeDirty: boolean
  saving: boolean
  settingsLoading: boolean
}) {
  return (
    <ConfigurationSection icon={Wrench} label="Runtime Policy">
      <EditableSection
        dirty={runtimeDirty}
        disabled={!draft || settingsLoading}
        onRevert={onRevert}
        onSave={onSave}
        saving={saving}
        title="Delivery, compaction, retry"
      >
        <div className="grid grid-cols-2 gap-2">
          <ToggleField
            checked={draft?.compaction.enabled ?? true}
            disabled={!draft}
            label="Compaction"
            onChange={onCompactionEnabledChange}
          />
          <ToggleField
            checked={draft?.retry.enabled ?? true}
            disabled={!draft}
            label="Retry"
            onChange={onRetryEnabledChange}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Reserve tokens"
            min={1}
            value={draft?.compaction.reserveTokens ?? 16384}
            onChange={onCompactionReserveTokensChange}
          />
          <NumberField
            label="Recent tokens"
            min={1}
            value={draft?.compaction.keepRecentTokens ?? 20000}
            onChange={onCompactionKeepRecentTokensChange}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Max retries"
            min={0}
            value={draft?.retry.maxRetries ?? 3}
            onChange={onRetryMaxRetriesChange}
          />
          <NumberField
            label="Base delay ms"
            min={0}
            value={draft?.retry.baseDelayMs ?? 2000}
            onChange={onRetryBaseDelayMsChange}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Steering"
            value={draft?.steeringMode ?? "one-at-a-time"}
            values={DELIVERY_MODES}
            onChange={onSteeringModeChange}
          />
          <SelectField
            label="Follow-ups"
            value={draft?.followUpMode ?? "one-at-a-time"}
            values={DELIVERY_MODES}
            onChange={onFollowUpModeChange}
          />
        </div>
        <SelectField
          label="Transport"
          value={draft?.transport ?? "auto"}
          values={TRANSPORTS}
          onChange={onTransportChange}
        />
      </EditableSection>
    </ConfigurationSection>
  )
}
