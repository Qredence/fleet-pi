import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { Type } from "typebox"
import {
  createDaytonaClient,
  executeCommand,
  runCode,
  uploadFile,
  downloadFile,
  listFiles,
  stopSandbox,
  startSandbox,
  deleteSandbox,
  getSandboxStatus,
  createSnapshot,
  deleteSnapshot,
  createVolumeMount,
  deleteVolume,
  getOrCreateVolume,
  listVolumes,
  type VolumeInfo,
} from "../../apps/web/src/lib/daytona/client"
import {
  getCachedUserSandbox,
  getSessionVolumeName,
  getUserSandbox,
  getVolumeName,
  type UserSandboxHandle,
} from "../../apps/web/src/lib/daytona/user-sandbox"
import { resolveDaytonaToolUser } from "../../apps/web/src/lib/daytona/tool-context"
import type { ExtensionContext } from "@earendil-works/pi-coding-agent"

const DOWNLOAD_PREVIEW_MAX_BYTES = 64 * 1024

export default function daytonaSandboxExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "daytona_create_sandbox",
    label: "Daytona Create Sandbox",
    description:
      "Create a new Daytona sandbox with optional image, snapshot, and resource configuration.",
    parameters: Type.Object({
      name: Type.Optional(
        Type.String({
          description: "Optional name for the sandbox",
        })
      ),
      image: Type.Optional(
        Type.String({
          description:
            "Optional Docker image (e.g., 'debian:12.9'). Defaults to debian:12.9",
        })
      ),
      snapshot: Type.Optional(
        Type.String({
          description: "Optional snapshot name to create from",
        })
      ),
      cpu: Type.Optional(
        Type.Number({
          description: "Optional CPU cores (default: 1)",
        })
      ),
      memory: Type.Optional(
        Type.Number({
          description: "Optional memory in GiB (default: 1)",
        })
      ),
      disk: Type.Optional(
        Type.Number({
          description: "Optional disk in GiB (default: 3)",
        })
      ),
      language: Type.Optional(
        Type.String({
          description:
            "Optional code runtime language: python, typescript, or javascript",
        })
      ),
      public: Type.Optional(
        Type.Boolean({
          description: "Whether sandbox port previews should be public",
        })
      ),
      autoStopInterval: Type.Optional(
        Type.Number({
          description: "Optional auto-stop interval in minutes",
        })
      ),
      volumeId: Type.Optional(
        Type.String({
          description: "Optional Daytona volume ID to mount",
        })
      ),
      volumeMountPath: Type.Optional(
        Type.String({
          description:
            "Absolute sandbox path where the Daytona volume should be mounted",
        })
      ),
      volumeSubpath: Type.Optional(
        Type.String({
          description:
            "Optional subpath inside the Daytona volume to expose at the mount path",
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const handle = await getAuthorizedHandle(ctx)
      assertSandboxName(handle, params.name)
      assertVolumeMount(handle, params.volumeId)
      if (params.volumeId && params.volumeMountPath) {
        createVolumeMount({
          volumeId: params.volumeId,
          mountPath: params.volumeMountPath,
          subpath: params.volumeSubpath,
        })
      }
      const sandbox = handle.sandbox

      return {
        content: [
          {
            type: "text",
            text: `Created Daytona sandbox:\n- ID: ${sandbox.id}\n- Name: ${sandbox.name}\n- State: ${sandbox.state}`,
          },
        ],
        details: {
          sandboxId: sandbox.id,
          sandboxName: sandbox.name,
          state: sandbox.state,
        },
      }
    },
  })

  pi.registerTool({
    name: "daytona_execute_command",
    label: "Daytona Execute Command",
    description:
      "Execute a shell command in a Daytona sandbox and return the output.",
    parameters: Type.Object({
      sandboxId: Type.String({
        description: "The sandbox ID to execute the command in",
      }),
      command: Type.String({
        description: "The shell command to execute",
      }),
      cwd: Type.Optional(
        Type.String({
          description: "Optional working directory inside the sandbox",
        })
      ),
      timeout: Type.Optional(
        Type.Number({
          description: "Optional timeout in seconds",
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sandbox = await getAuthorizedSandbox(ctx, params.sandboxId)
      const result = await executeCommand(
        sandbox,
        params.command,
        params.cwd,
        undefined,
        params.timeout
      )

      return {
        content: [
          {
            type: "text",
            text: `Command executed with exit code ${result.exitCode}:\n${result.result}`,
          },
        ],
        details: {
          exitCode: result.exitCode,
          output: result.result,
        },
      }
    },
  })

  pi.registerTool({
    name: "daytona_run_code",
    label: "Daytona Run Code",
    description:
      "Run code in the sandbox's language runtime (Python, TypeScript, or JavaScript). Language is set at sandbox creation time.",
    parameters: Type.Object({
      sandboxId: Type.String({
        description: "The sandbox ID to run code in",
      }),
      code: Type.String({
        description: "The code to execute",
      }),
      timeout: Type.Optional(
        Type.Number({
          description: "Optional timeout in seconds",
        })
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sandbox = await getAuthorizedSandbox(ctx, params.sandboxId)
      const result = await runCode(sandbox, params.code, params.timeout)

      return {
        content: [
          {
            type: "text",
            text: `Code executed with exit code ${result.exitCode}:\n${result.result}`,
          },
        ],
        details: {
          exitCode: result.exitCode,
          output: result.result,
        },
      }
    },
  })

  pi.registerTool({
    name: "daytona_upload_file",
    label: "Daytona Upload File",
    description: "Upload a file to a Daytona sandbox.",
    parameters: Type.Object({
      sandboxId: Type.String({
        description: "The sandbox ID to upload to",
      }),
      content: Type.String({
        description: "The file content to upload",
      }),
      path: Type.String({
        description: "The destination path in the sandbox",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sandbox = await getAuthorizedSandbox(ctx, params.sandboxId)
      await uploadFile(sandbox, params.content, params.path)

      return {
        content: [
          {
            type: "text",
            text: `Uploaded file to ${params.path}`,
          },
        ],
        details: {
          path: params.path,
        },
      }
    },
  })

  pi.registerTool({
    name: "daytona_download_file",
    label: "Daytona Download File",
    description: "Download a file from a Daytona sandbox.",
    parameters: Type.Object({
      sandboxId: Type.String({
        description: "The sandbox ID to download from",
      }),
      path: Type.String({
        description: "The path of the file to download",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sandbox = await getAuthorizedSandbox(ctx, params.sandboxId)
      const buffer = await downloadFile(sandbox, params.path)
      const previewBuffer = buffer.subarray(0, DOWNLOAD_PREVIEW_MAX_BYTES)
      const content = previewBuffer.toString("utf-8")
      const truncated = buffer.length > DOWNLOAD_PREVIEW_MAX_BYTES
      const suffix = truncated
        ? `\n\n[truncated after ${DOWNLOAD_PREVIEW_MAX_BYTES} bytes]`
        : ""

      return {
        content: [
          {
            type: "text",
            text: `Downloaded file from ${params.path} (${buffer.length} bytes):\n${content}${suffix}`,
          },
        ],
        details: {
          path: params.path,
          size: buffer.length,
          preview: content,
          previewBytes: previewBuffer.length,
          truncated,
        },
      }
    },
  })

  pi.registerTool({
    name: "daytona_list_files",
    label: "Daytona List Files",
    description: "List files in a sandbox directory.",
    parameters: Type.Object({
      sandboxId: Type.String({
        description: "The sandbox ID to list files in",
      }),
      path: Type.String({
        description: "The directory path to list",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sandbox = await getAuthorizedSandbox(ctx, params.sandboxId)
      const files = await listFiles(sandbox, params.path)

      const fileList = files
        .map((f) => `${f.isDir ? "[DIR] " : ""}${f.name} (${f.size} bytes)`)
        .join("\n")

      return {
        content: [
          {
            type: "text",
            text: `Files in ${params.path}:\n${fileList}`,
          },
        ],
        details: {
          path: params.path,
          files,
        },
      }
    },
  })

  pi.registerTool({
    name: "daytona_stop_sandbox",
    label: "Daytona Stop Sandbox",
    description: "Stop a running Daytona sandbox.",
    parameters: Type.Object({
      sandboxId: Type.String({
        description: "The sandbox ID to stop",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sandbox = await getAuthorizedSandbox(ctx, params.sandboxId)
      await stopSandbox(sandbox)

      return {
        content: [
          {
            type: "text",
            text: `Stopped sandbox ${params.sandboxId}`,
          },
        ],
        details: {
          sandboxId: params.sandboxId,
        },
      }
    },
  })

  pi.registerTool({
    name: "daytona_start_sandbox",
    label: "Daytona Start Sandbox",
    description: "Start a stopped Daytona sandbox.",
    parameters: Type.Object({
      sandboxId: Type.String({
        description: "The sandbox ID to start",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sandbox = await getAuthorizedSandbox(ctx, params.sandboxId)
      await startSandbox(sandbox)

      return {
        content: [
          {
            type: "text",
            text: `Started sandbox ${params.sandboxId}`,
          },
        ],
        details: {
          sandboxId: params.sandboxId,
        },
      }
    },
  })

  pi.registerTool({
    name: "daytona_delete_sandbox",
    label: "Daytona Delete Sandbox",
    description: "Delete a Daytona sandbox permanently.",
    parameters: Type.Object({
      sandboxId: Type.String({
        description: "The sandbox ID to delete",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sandbox = await getAuthorizedSandbox(ctx, params.sandboxId)
      await deleteSandbox(sandbox)

      return {
        content: [
          {
            type: "text",
            text: `Deleted sandbox ${params.sandboxId}`,
          },
        ],
        details: {
          sandboxId: params.sandboxId,
        },
      }
    },
  })

  pi.registerTool({
    name: "daytona_get_status",
    label: "Daytona Get Status",
    description: "Get the current status of a Daytona sandbox.",
    parameters: Type.Object({
      sandboxId: Type.String({
        description: "The sandbox ID to get status for",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const sandbox = await getAuthorizedSandbox(ctx, params.sandboxId)
      const status = await getSandboxStatus(sandbox)

      return {
        content: [
          {
            type: "text",
            text: `Sandbox status:\n- ID: ${status.id}\n- Name: ${status.name}\n- State: ${status.state}`,
          },
        ],
        details: status,
      }
    },
  })

  pi.registerTool({
    name: "daytona_get_or_create_volume",
    label: "Daytona Get Or Create Volume",
    description:
      "Get a Daytona volume by name, creating it if it does not exist.",
    parameters: Type.Object({
      name: Type.String({
        description: "The Daytona volume name",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const userId = requireDaytonaToolUser(ctx)
      assertUserVolumeName(userId, params.name)
      const client = createDaytonaClient()
      const volume = await getOrCreateVolume(client, params.name)

      return {
        content: [
          {
            type: "text",
            text: `Daytona volume:\n- ID: ${volume.id}\n- Name: ${volume.name}\n- State: ${volume.state ?? "unknown"}`,
          },
        ],
        details: volume,
      }
    },
  })

  pi.registerTool({
    name: "daytona_list_volumes",
    label: "Daytona List Volumes",
    description:
      "List Daytona volumes available to the configured organization.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const userId = requireDaytonaToolUser(ctx)
      const client = createDaytonaClient()
      const volumes = filterUserVolumes(userId, await listVolumes(client))
      const summary = volumes
        .map(
          (volume) =>
            `- ${volume.name} (${volume.id}) ${volume.state ?? "unknown"}`
        )
        .join("\n")

      return {
        content: [
          {
            type: "text",
            text: summary
              ? `Daytona volumes:\n${summary}`
              : "No Daytona volumes found.",
          },
        ],
        details: { volumes },
      }
    },
  })

  pi.registerTool({
    name: "daytona_delete_volume",
    label: "Daytona Delete Volume",
    description:
      "Delete a Daytona volume by name. This permanently removes persisted volume data.",
    parameters: Type.Object({
      name: Type.String({
        description: "The Daytona volume name to delete",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const userId = requireDaytonaToolUser(ctx)
      assertUserVolumeName(userId, params.name)
      const client = createDaytonaClient()
      await deleteVolume(client, params.name)

      return {
        content: [
          {
            type: "text",
            text: `Deleted Daytona volume: ${params.name}`,
          },
        ],
        details: {
          name: params.name,
        },
      }
    },
  })
  pi.registerTool({
    name: "daytona_create_snapshot",
    label: "Daytona Create Snapshot",
    description:
      "Create a Daytona snapshot from an image definition for reusable sandbox environments.",
    parameters: Type.Object({
      name: Type.String({
        description: "The name for the snapshot",
      }),
      image: Type.String({
        description: "The Docker image to create the snapshot from",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const client = createDaytonaClient()
      const snapshot = await createSnapshot(client, params.name, params.image)

      return {
        content: [
          {
            type: "text",
            text: `Created snapshot: ${snapshot.name}`,
          },
        ],
        details: snapshot,
      }
    },
  })

  pi.registerTool({
    name: "daytona_delete_snapshot",
    label: "Daytona Delete Snapshot",
    description: "Delete a Daytona snapshot.",
    parameters: Type.Object({
      name: Type.String({
        description: "The name of the snapshot to delete",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const client = createDaytonaClient()
      await deleteSnapshot(client, params.name)

      return {
        content: [
          {
            type: "text",
            text: `Deleted snapshot: ${params.name}`,
          },
        ],
        details: {
          name: params.name,
        },
      }
    },
  })
}

function requireDaytonaToolUser(ctx: ExtensionContext): string {
  const userId = resolveDaytonaToolUser(
    ctx.sessionManager.getSessionId(),
    ctx.sessionManager.getSessionFile()
  )
  if (!userId) {
    throw new Error("Daytona tools require an authenticated Fleet Pi session.")
  }
  return userId
}

async function getAuthorizedHandle(ctx: ExtensionContext) {
  const userId = requireDaytonaToolUser(ctx)
  return getCachedUserSandbox(userId) ?? getUserSandbox({ userId })
}

async function getAuthorizedSandbox(ctx: ExtensionContext, sandboxId: string) {
  const handle = await getAuthorizedHandle(ctx)
  assertSandboxId(handle, sandboxId)
  return handle.sandbox
}

function assertSandboxId(handle: UserSandboxHandle, sandboxId: string) {
  if (sandboxId !== handle.sandboxId && sandboxId !== handle.sandbox.name) {
    throw new Error(
      "Daytona sandbox access is limited to your Fleet Pi sandbox."
    )
  }
}

function assertSandboxName(
  handle: UserSandboxHandle,
  name: string | undefined
) {
  // Undefined means "use my tracked Fleet Pi sandbox".
  if (name && name !== handle.sandbox.name && name !== handle.sandboxId) {
    throw new Error(
      "Daytona sandbox creation is limited to your Fleet Pi sandbox."
    )
  }
}

function assertVolumeMount(
  handle: UserSandboxHandle,
  volumeId: string | undefined
) {
  if (volumeId && volumeId !== handle.volumeId) {
    throw new Error(
      "Daytona volume mounts are limited to your Fleet Pi volume."
    )
  }
}

function assertUserVolumeName(userId: string, name: string) {
  const allowed = new Set([getVolumeName(userId), getSessionVolumeName(userId)])
  if (!allowed.has(name)) {
    throw new Error(
      "Daytona volume access is limited to your Fleet Pi volumes."
    )
  }
}

function filterUserVolumes(userId: string, volumes: Array<VolumeInfo>) {
  const allowed = new Set([getVolumeName(userId), getSessionVolumeName(userId)])
  return volumes.filter((volume) => allowed.has(volume.name))
}
