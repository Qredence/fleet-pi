import { CircleAlert } from "lucide-react"
import {
  ResourceChipSection,
  ResourceNotice,
  getResourceGroups,
} from "./shared"
import { ResourcesSkeleton } from "./skeleton-loaders"
import type {
  ChatResourcesResponse,
  WorkspaceTreeResponse,
} from "@/lib/pi/chat-protocol"

export function ResourcesPanelContent({
  error,
  loading,
  resources,
  workspace,
}: {
  error?: Error | null
  loading: boolean
  resources: ChatResourcesResponse | null
  workspace: WorkspaceTreeResponse | null
}) {
  const groups = getResourceGroups(resources, workspace)
  const diagnostics = resources?.diagnostics ?? []

  return (
    <>
      {error && (
        <ResourceNotice
          icon={CircleAlert}
          title="Unable to load resources"
          description={error.message}
        />
      )}
      {!error && loading && !resources && <ResourcesSkeleton />}
      {!error &&
        resources &&
        groups.map((group) => (
          <ResourceChipSection key={group.id} {...group} />
        ))}
      {!error && diagnostics.length > 0 && (
        <div className="mt-4 border-t border-border/60 pt-3">
          <ResourceChipSection
            id="diagnostics"
            label="Diagnostics"
            icon={CircleAlert}
            items={diagnostics.map((diagnostic, index) => ({
              name: `Diagnostic ${index + 1}`,
              description: diagnostic,
            }))}
          />
        </div>
      )}
    </>
  )
}
