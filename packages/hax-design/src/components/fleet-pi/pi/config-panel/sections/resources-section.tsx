import { Cable } from "lucide-react"
import {
  ConfigurationRow,
  ConfigurationSection,
  EditableSection,
  FieldLabel,
  InlineNotice,
  ToggleField,
} from "../shared/fields"
import { PathListField, StringListEditor } from "../shared/lists"
import type { ChatPiSettings } from "../../../../../lib/pi/chat-protocol"

export function ResourcesSection({
  draft,
  onEnableSkillCommandsChange,
  onExtensionsChange,
  onPackageRowsChange,
  onPromptsChange,
  onRevert,
  onSave,
  onSkillsChange,
  onThemesChange,
  packageError,
  packageRows,
  resourceDirty,
  resourceSummary,
  saving,
  settingsLoading,
}: {
  draft: ChatPiSettings | null
  onEnableSkillCommandsChange: (enabled: boolean) => void
  onExtensionsChange: (extensions: Array<string>) => void
  onPackageRowsChange: (rows: Array<string>) => void
  onPromptsChange: (prompts: Array<string>) => void
  onRevert: () => void
  onSave: () => void
  onSkillsChange: (skills: Array<string>) => void
  onThemesChange: (themes: Array<string>) => void
  packageError?: string
  packageRows: Array<string>
  resourceDirty: boolean
  resourceSummary: {
    total: number
    reloadRequired: number
  }
  saving: boolean
  settingsLoading: boolean
}) {
  return (
    <ConfigurationSection icon={Cable} label="Resources">
      <ConfigurationRow
        description={
          resourceSummary.total > 0
            ? `${resourceSummary.total} cataloged resources. ${resourceSummary.reloadRequired} require a reload.`
            : "No resources are currently cataloged."
        }
        status={resourceSummary.total > 0 ? "Cataloged" : "Empty"}
        title="Resource catalog"
      />
      <EditableSection
        dirty={resourceDirty}
        disabled={!draft || settingsLoading || !!packageError}
        onRevert={onRevert}
        onSave={onSave}
        saving={saving}
        title="Packages and paths"
      >
        <InlineNotice>
          Resource changes are project-scoped and become reliable in a new or
          reloaded Pi session.
        </InlineNotice>
        <FieldLabel label="Packages">
          <StringListEditor
            addLabel="Add package"
            emptyLabel="No Pi packages configured."
            placeholder='npm:pi-skills or {"source":"npm:pkg"}'
            values={packageRows}
            onChange={onPackageRowsChange}
          />
          {packageError ? (
            <p className="text-[11px] leading-4 text-red-300">{packageError}</p>
          ) : null}
        </FieldLabel>
        <PathListField
          label="Extensions"
          values={draft?.extensions ?? []}
          addLabel="Add extension path"
          onChange={onExtensionsChange}
        />
        <PathListField
          label="Skills"
          values={draft?.skills ?? []}
          addLabel="Add skill path"
          onChange={onSkillsChange}
        />
        <PathListField
          label="Prompts"
          values={draft?.prompts ?? []}
          addLabel="Add prompt path"
          onChange={onPromptsChange}
        />
        <PathListField
          label="Themes"
          values={draft?.themes ?? []}
          addLabel="Add theme path"
          onChange={onThemesChange}
        />
        <ToggleField
          checked={draft?.enableSkillCommands ?? true}
          disabled={!draft}
          label="Skill slash commands"
          onChange={onEnableSkillCommandsChange}
        />
      </EditableSection>
    </ConfigurationSection>
  )
}
