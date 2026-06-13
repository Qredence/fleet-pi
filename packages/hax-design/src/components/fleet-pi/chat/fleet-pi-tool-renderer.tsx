import { memo, useMemo } from "react"
import { ToolRenderer } from "../../agent-elements/tools/tool-renderer"
import { getToolStatus } from "../../agent-elements/utils/format-tool"
import { GenericTool } from "../../agent-elements/tools/generic-tool"
import { EditTool } from "../../agent-elements/tools/edit-tool"
import { toolRegistry } from "../../agent-elements/tools/tool-registry"
import { resolveWorkspacePathFromToolInput } from "../../../lib/workspace-path-nav"
import { useRightPanelContext } from "../layout/right-panel-context"
import {
  PI_TOOL_RENDERERS,
  WorkspaceWriteToolRenderer,
} from "../pi/tool-renderers"
import type { ToolRendererProps } from "../../agent-elements/tools/tool-renderer"

const EMPTY_TOOL_INPUT = {} as Record<string, unknown>

function getToolInput(part: ToolRendererProps["part"]) {
  return (part.input ?? part.args ?? EMPTY_TOOL_INPUT) as Record<
    string,
    unknown
  >
}

export const FleetPiToolRenderer = memo(function FleetPiToolRenderer(
  props: ToolRendererProps
) {
  const { openWorkspacePath } = useRightPanelContext()
  const partType = props.part.type as string
  const toolInput = getToolInput(props.part)

  const target = useMemo(
    () => resolveWorkspacePathFromToolInput(getToolInput(props.part)),
    [props.part.input, props.part.args]
  )

  if (partType === "tool-Edit" || partType === "tool-Write") {
    return (
      <EditTool
        part={props.part}
        onFilePathClick={target ? openWorkspacePath : undefined}
      />
    )
  }

  if (partType === "tool-workspace_write") {
    return (
      <WorkspaceWriteToolRenderer
        name="workspace_write"
        input={toolInput}
        output={props.part.output ?? props.part.result}
        status={
          props.part.state === "output-error"
            ? "error"
            : props.part.state === "output-available"
              ? "success"
              : "pending"
        }
        onOpenPath={openWorkspacePath}
      />
    )
  }

  if (partType === "tool-Read" && target) {
    const meta = toolRegistry[partType]
    const { isPending, isError } = getToolStatus(props.part, props.chatStatus)
    return (
      <GenericTool
        icon={meta.icon}
        title={meta.title(props.part)}
        subtitle={meta.subtitle?.(props.part)}
        isPending={isPending}
        isError={isError}
        onSubtitleClick={() => openWorkspacePath(target.path)}
      />
    )
  }

  return <ToolRenderer {...props} toolRenderers={PI_TOOL_RENDERERS} />
})
