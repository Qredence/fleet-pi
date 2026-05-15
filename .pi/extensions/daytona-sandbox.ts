import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { Type } from "typebox"
import {
  createDaytonaClient,
  createSandbox,
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
  type SandboxConfig,
  type ExecuteResult,
  type FileListEntry,
} from "../../apps/web/src/lib/daytona/client"

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
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const client = createDaytonaClient()
      const config: SandboxConfig = {
        name: params.name,
        image: params.image,
        snapshot: params.snapshot,
        cpu: params.cpu,
        memory: params.memory,
        disk: params.disk,
      }
      const sandbox = await createSandbox(client, config)

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
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const client = createDaytonaClient()
      const sandbox = await client.get(params.sandboxId)
      const result = await executeCommand(sandbox, params.command)

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
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const client = createDaytonaClient()
      const sandbox = await client.get(params.sandboxId)
      const result = await runCode(sandbox, params.code)

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
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const client = createDaytonaClient()
      const sandbox = await client.get(params.sandboxId)
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
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const client = createDaytonaClient()
      const sandbox = await client.get(params.sandboxId)
      const buffer = await downloadFile(sandbox, params.path)
      const content = buffer.toString("utf-8")

      return {
        content: [
          {
            type: "text",
            text: `Downloaded file from ${params.path} (${buffer.length} bytes):\n${content}`,
          },
        ],
        details: {
          path: params.path,
          size: buffer.length,
          content,
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
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const client = createDaytonaClient()
      const sandbox = await client.get(params.sandboxId)
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
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const client = createDaytonaClient()
      const sandbox = await client.get(params.sandboxId)
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
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const client = createDaytonaClient()
      const sandbox = await client.get(params.sandboxId)
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
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const client = createDaytonaClient()
      const sandbox = await client.get(params.sandboxId)
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
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const client = createDaytonaClient()
      const sandbox = await client.get(params.sandboxId)
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
