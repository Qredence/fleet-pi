import { Boxes, Download, FolderTree } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ComponentType } from "react"
import type { CustomToolRendererProps } from "@workspace/ui/components/agent-elements/types"

export const PI_TOOL_RENDERERS: Record<
  string,
  ComponentType<CustomToolRendererProps>
> = {
  project_inventory: ProjectInventoryToolRenderer,
  resource_install: ResourceInstallToolRenderer,
  workspace_index: WorkspaceIndexToolRenderer,
}

function ProjectInventoryToolRenderer({
  input,
  output,
  status,
}: CustomToolRendererProps) {
  const details = getDetails(output)
  const resources = getRecordArray(details.resources)
  const focus = getString(details.focus) ?? getString(input.focus)
  const populatedRoots = resources.filter(
    (resource) => getStringArray(resource.entries).length > 0
  ).length

  return (
    <RuntimeToolCard
      icon={Boxes}
      status={status}
      title="Project inventory"
      summary={`${resources.length} resource roots scanned`}
      details={[
        focus ? `Focus: ${focus}` : null,
        `${populatedRoots} roots currently contain resources`,
        ...resources.slice(0, 3).map((resource) => {
          const dir = getString(resource.dir) ?? "resource root"
          const count = getStringArray(resource.entries).length
          return `${dir}: ${count} entr${count === 1 ? "y" : "ies"}`
        }),
      ]}
    />
  )
}

function WorkspaceIndexToolRenderer({
  output,
  status,
}: CustomToolRendererProps) {
  const details = getDetails(output)
  const runtimeTools = getStringArray(details.runtimeTools)
  const missingPaths = getStringArray(details.missingPaths)
  const projectMemory = getRecord(details.projectMemory)
  const canonicalMemory = getRecordArray(projectMemory.canonical).length
  const workspaceExists = details.exists !== false

  return (
    <RuntimeToolCard
      icon={FolderTree}
      status={status}
      title="Workspace index"
      summary={
        workspaceExists
          ? "agent-workspace available"
          : "agent-workspace missing"
      }
      details={[
        `${runtimeTools.length} runtime tools advertised`,
        `${canonicalMemory} canonical project-memory files indexed`,
        missingPaths.length > 0
          ? `${missingPaths.length} expected paths missing`
          : "No missing workspace paths reported",
        missingPaths[0] ? `First missing path: ${missingPaths[0]}` : null,
      ]}
    />
  )
}

function ResourceInstallToolRenderer({
  input,
  output,
  status,
}: CustomToolRendererProps) {
  const details = getDetails(output)
  const kind = getString(details.kind) ?? getString(input.kind) ?? "resource"
  const name = getString(details.name) ?? getString(input.name) ?? "Install"
  const activationStatus = getString(details.activationStatus)
  const installedPath = getString(details.installedPath)
  const settingsUpdated =
    typeof details.settingsUpdated === "boolean"
      ? details.settingsUpdated
      : undefined

  return (
    <RuntimeToolCard
      icon={Download}
      status={status}
      title={`Resource install: ${name}`}
      summary={`${capitalize(kind)} ${status === "error" ? "failed" : "updated"}`}
      details={[
        activationStatus ? `Activation: ${activationStatus}` : null,
        installedPath ? `Path: ${installedPath}` : null,
        settingsUpdated === undefined
          ? null
          : settingsUpdated
            ? ".pi/settings.json compatibility paths updated"
            : ".pi/settings.json already matched the workspace install",
      ]}
    />
  )
}

function RuntimeToolCard({
  details,
  icon: Icon,
  status,
  summary,
  title,
}: {
  details: Array<string | null>
  icon: LucideIcon
  status: CustomToolRendererProps["status"]
  summary: string
  title: string
}) {
  const tone =
    status === "error"
      ? "border-rose-500/30 bg-rose-500/8 text-rose-100"
      : status === "pending" || status === "streaming"
        ? "border-sky-500/25 bg-sky-500/8 text-sky-100"
        : "border-border/70 bg-background text-foreground/80"
  const statusLabel =
    status === "error"
      ? "Error"
      : status === "pending" || status === "streaming"
        ? "Running"
        : "Ready"

  return (
    <div className={`rounded-[12px] border px-3 py-2.5 shadow-sm ${tone}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/6">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1 truncate text-[13px] font-medium">
              {title}
            </div>
            <span className="shrink-0 rounded-full bg-foreground/8 px-2 py-0.5 text-[10px] tracking-wide text-foreground/60 uppercase">
              {statusLabel}
            </span>
          </div>
          <p className="text-[12px] leading-4 text-foreground/60">{summary}</p>
          <div className="space-y-1">
            {details.filter(Boolean).map((detail) => (
              <div
                key={detail}
                className="text-[11px] leading-4 text-foreground/45"
              >
                {detail}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function getDetails(output: unknown) {
  const record = getRecord(output)
  return getRecord(record.details)
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function getRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object"
      )
    : []
}

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function getStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
