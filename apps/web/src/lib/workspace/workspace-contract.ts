import { z } from "zod"

export const AGENT_WORKSPACE_DIRECTORY = "agent-workspace"
export const WORKSPACE_CONTRACT_VERSION = 1
export const WORKSPACE_MANIFEST_RELATIVE_PATH = "manifest.json"

export const WORKSPACE_TOP_LEVEL_SECTIONS = [
  "instructions",
  "memory",
  "plans",
  "skills",
  "evals",
  "artifacts",
  "scratch",
  "pi",
  "policies",
  "indexes",
] as const

export const WORKSPACE_SECTION_KINDS = [
  "canonical",
  "temporary",
  "projection",
] as const

export type WorkspaceSectionName = (typeof WORKSPACE_TOP_LEVEL_SECTIONS)[number]
export type WorkspaceSectionKind = (typeof WORKSPACE_SECTION_KINDS)[number]

export type WorkspaceSectionDefinition = {
  name: WorkspaceSectionName
  path: WorkspaceSectionName
  kind: WorkspaceSectionKind
}

export const WORKSPACE_SECTION_DEFINITIONS: ReadonlyArray<WorkspaceSectionDefinition> =
  [
    { name: "instructions", path: "instructions", kind: "canonical" },
    { name: "memory", path: "memory", kind: "canonical" },
    { name: "plans", path: "plans", kind: "canonical" },
    { name: "skills", path: "skills", kind: "canonical" },
    { name: "evals", path: "evals", kind: "canonical" },
    { name: "artifacts", path: "artifacts", kind: "canonical" },
    { name: "scratch", path: "scratch", kind: "temporary" },
    { name: "pi", path: "pi", kind: "canonical" },
    { name: "policies", path: "policies", kind: "canonical" },
    { name: "indexes", path: "indexes", kind: "projection" },
  ]

export const WORKSPACE_REQUIRED_DIRECTORY_PATHS = [
  ...WORKSPACE_TOP_LEVEL_SECTIONS,
  "memory/daily",
  "memory/project",
  "memory/research",
  "plans/active",
  "plans/completed",
  "plans/abandoned",
  "artifacts/reports",
  "artifacts/datasets",
  "artifacts/traces",
  "artifacts/diagrams",
  "scratch/tmp",
  "pi/skills",
  "pi/prompts",
  "pi/extensions",
  "pi/extensions/enabled",
  "pi/extensions/staged",
  "pi/packages",
] as const

export const WORKSPACE_POLICY_FILE_DEFINITIONS = [
  {
    key: "workspace-policy",
    path: "policies/workspace-policy.md",
    contents: [
      "# Workspace Policy",
      "",
      "`agent-workspace/` is Fleet Pi's canonical durable adaptive state.",
      "Bootstrap should preserve user-authored files.",
    ].join("\n"),
  },
  {
    key: "tool-policy",
    path: "policies/tool-policy.md",
    contents: [
      "# Tool Policy",
      "",
      "Use repo-scoped tools and keep durable changes reviewable in Git.",
    ].join("\n"),
  },
  {
    key: "self-improvement-policy",
    path: "policies/self-improvement-policy.md",
    contents: [
      "# Self-Improvement Policy",
      "",
      "Record durable improvements in canonical files instead of hidden state.",
    ].join("\n"),
  },
  {
    key: "constraints",
    path: "policies/constraints.md",
    contents: [
      "# Constraints",
      "",
      "Keep projection data non-canonical and preserve Plan Mode as read-only.",
    ].join("\n"),
  },
] as const

export const WORKSPACE_SCRATCH_PROTECTION_PATHS = [
  "scratch/tmp/.gitkeep",
] as const

const workspaceSectionNameSchema = z.enum(WORKSPACE_TOP_LEVEL_SECTIONS)
const workspaceSectionKindSchema = z.enum(WORKSPACE_SECTION_KINDS)

const workspaceManifestSectionSchema = z.object({
  name: workspaceSectionNameSchema,
  path: z.string(),
  kind: workspaceSectionKindSchema,
})

export const workspaceManifestSchema = z.object({
  version: z.literal(WORKSPACE_CONTRACT_VERSION),
  generatedBy: z.literal("fleet-pi"),
  workspaceRoot: z.literal(AGENT_WORKSPACE_DIRECTORY),
  sections: z.array(workspaceManifestSectionSchema),
  policies: z.array(
    z.object({
      key: z.string(),
      path: z.string(),
    })
  ),
  scratch: z.object({
    path: z.string(),
    temporary: z.literal(true),
    protectionPaths: z.array(z.string()),
  }),
  projection: z.object({
    path: z.string(),
    canonical: z.literal(false),
  }),
})

export type WorkspaceManifest = z.infer<typeof workspaceManifestSchema>

export function createDefaultWorkspaceManifest(): WorkspaceManifest {
  return {
    version: WORKSPACE_CONTRACT_VERSION,
    generatedBy: "fleet-pi",
    workspaceRoot: AGENT_WORKSPACE_DIRECTORY,
    sections: WORKSPACE_SECTION_DEFINITIONS.map((section) => ({
      name: section.name,
      path: toWorkspaceProjectPath(section.path),
      kind: section.kind,
    })),
    policies: WORKSPACE_POLICY_FILE_DEFINITIONS.map((policy) => ({
      key: policy.key,
      path: toWorkspaceProjectPath(policy.path),
    })),
    scratch: {
      path: toWorkspaceProjectPath("scratch"),
      temporary: true,
      protectionPaths: WORKSPACE_SCRATCH_PROTECTION_PATHS.map(
        toWorkspaceProjectPath
      ),
    },
    projection: {
      path: toWorkspaceProjectPath("indexes"),
      canonical: false,
    },
  }
}

export function toWorkspaceProjectPath(workspaceRelativePath: string) {
  return `${AGENT_WORKSPACE_DIRECTORY}/${workspaceRelativePath}`
}
