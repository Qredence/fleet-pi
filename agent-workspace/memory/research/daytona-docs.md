# Daytona Documentation Reference

> Source: https://www.daytona.io/docs/llms-full.txt  
> Generated: 2026-05-14  
> Full LLM doc: https://www.daytona.io/docs/llms-full.txt  
> Index: https://www.daytona.io/docs/llms.txt

---

## What is Daytona

Daytona is an **open-source, secure and elastic infrastructure for running AI-generated code**. It provides full composable computers — **sandboxes** — with complete isolation: dedicated kernel, filesystem, network stack, and allocated vCPU, RAM, and disk.

- Sandboxes spin up in **under 90ms**
- Runtimes: **Python, TypeScript, JavaScript**
- Built on OCI/Docker compatibility, massive parallelization, unlimited persistence
- Ideal for AI agent architectures with stateful environment snapshots

---

## Platform Architecture

Three planes:

| Plane         | Components                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Interface** | SDKs (Python/TS/Ruby/Go/Java), CLI, Dashboard, MCP, SSH                                                                            |
| **Control**   | API (NestJS, Redis, PostgreSQL), Proxy (host-based routing `{port}-{sandboxId}.{proxy-domain}`), Snapshot builder, Sandbox manager |
| **Compute**   | Sandbox runners (isolated Linux namespaces), Sandbox daemon (Toolbox API), Snapshot store (OCI registry on S3), Volumes            |

---

## SDKs

| Language      | Install                                           |
| ------------- | ------------------------------------------------- |
| Python        | `pip install daytona`                             |
| TypeScript    | `npm install @daytona/sdk`                        |
| Ruby          | `gem install daytona`                             |
| Go            | `go get github.com/daytonaio/daytona/libs/sdk-go` |
| Java (Gradle) | `implementation("io.daytona:sdk-java:0.1.0")`     |

TS SDK ships as dual ESM/CJS. Works in Node, Bun, Next.js, Nuxt, Remix, Vite SSR, AWS Lambda, Azure Functions.  
Cloudflare Workers: add `nodejs_compat` flag.  
Deno: `deno add npm:@daytona/sdk`.  
Browser/Vite: install `vite-plugin-node-polyfills`.

---

## CLI

```bash
# Mac/Linux
brew install daytonaio/cli/daytona

# Windows
powershell -Command "irm https://get.daytona.io/windows | iex"
```

---

## Configuration

Precedence order:

1. Code (`DaytonaConfig`)
2. Environment variables
3. `.env` file
4. Default values

```python
from daytona import DaytonaConfig
config = DaytonaConfig(api_key="YOUR_API_KEY", api_url="YOUR_API_URL", target="us")
```

```typescript
const config: DaytonaConfig = {
  apiKey: "YOUR_API_KEY",
  apiUrl: "YOUR_API_URL",
  target: "us",
}
```

| Env Var           | Description                                     | Required |
| ----------------- | ----------------------------------------------- | -------- |
| `DAYTONA_API_KEY` | API key                                         | Yes      |
| `DAYTONA_API_URL` | API URL (default: `https://app.daytona.io/api`) | No       |
| `DAYTONA_TARGET`  | Region (`us`/`eu`)                              | No       |

---

## Sandboxes

### Default Resources

| Resource | Default | Min | Max |
| -------- | ------- | --- | --- |
| CPU      | 1 vCPU  | 1   | 4   |
| Memory   | 1 GiB   | 1   | 8   |
| Disk     | 3 GiB   | 1   | 10  |

### Sandbox Lifecycle States

`Creating` → `Starting` → `Started` → `Stopping` → `Stopped` → `Archiving` → `Archived` → `Deleting` → `Deleted`  
Also: `Resizing`, `Error` (recoverable), `Restoring`, `Pulling/Building Snapshot`, `Build Pending/Failed`

### Create Sandbox

```python
from daytona import Daytona
daytona = Daytona()
sandbox = daytona.create()
```

```typescript
import { Daytona } from "@daytona/sdk"
const daytona = new Daytona()
const sandbox = await daytona.create()
```

### Create with Custom Resources

```python
from daytona import Daytona, CreateSandboxFromImageParams, Image, Resources
sandbox = daytona.create(CreateSandboxFromImageParams(
    image=Image.debian_slim("3.12"),
    resources=Resources(cpu=2, memory=4, disk=8)
))
```

```typescript
const sandbox = await daytona.create({
  image: Image.debianSlim("3.12"),
  resources: { cpu: 2, memory: 4, disk: 8 },
})
```

### Ephemeral Sandbox (auto-deletes on stop)

```python
sandbox = daytona.create(CreateSandboxFromSnapshotParams(ephemeral=True, auto_stop_interval=5))
```

```typescript
const sandbox = await daytona.create({ ephemeral: true, autoStopInterval: 5 })
```

### Create from Snapshot

```python
sandbox = daytona.create(CreateSandboxFromSnapshotParams(snapshot="my-snapshot-name"))
```

### Create with Declarative Image

```python
image = Image.debian_slim("3.12").pip_install(["requests", "pandas"]).workdir("/home/daytona")
sandbox = daytona.create(CreateSandboxFromImageParams(image=image), on_snapshot_create_logs=print)
```

```typescript
const image = Image.debianSlim("3.12")
  .pipInstall(["requests", "pandas"])
  .workdir("/home/daytona")
const sandbox = await daytona.create(
  { image },
  { onSnapshotCreateLogs: console.log }
)
```

### Create with Volumes

```python
volume = daytona.volume.get("my-volume", create=True)
sandbox = daytona.create(CreateSandboxFromSnapshotParams(
    volumes=[VolumeMount(volume_id=volume.id, mount_path="/home/daytona/data")]
))
```

### Sandbox Lifecycle Methods

```python
sandbox.start()
sandbox.stop()
sandbox.archive()
sandbox.recover()      # when sandbox.recoverable is True
sandbox.delete()
sandbox.resize(Resources(cpu=2, memory=4))
```

```typescript
await sandbox.start()
await sandbox.stop()
await sandbox.archive()
await sandbox.delete()
await sandbox.resize({ cpu: 2, memory: 4 })
```

### Run Code

```python
response = sandbox.process.code_run('print("Hello World")')
print(response.result)  # exit_code is also available
```

```typescript
const response = await sandbox.process.codeRun('console.log("Hello World")')
console.log(response.result)
```

### Execute Commands

```python
response = sandbox.process.exec("echo 'Hello, World!'")
```

```typescript
const response = await sandbox.process.executeCommand('echo "Hello, World!"')
```

### Automated Lifecycle

| Parameter               | Default | Notes                                                |
| ----------------------- | ------- | ---------------------------------------------------- |
| `auto_stop_interval`    | 15 min  | `0` = disabled; resets on external interaction only  |
| `auto_archive_interval` | 7 days  | `0` = 30 days max                                    |
| `auto_delete_interval`  | never   | `0` = delete immediately after stop; `-1` = disabled |

What resets inactivity timer: sandbox lifecycle state updates, network requests via previews, SSH connections, Toolbox API calls.  
What does NOT reset it: background scripts, long-running tasks, SDK non-toolbox requests.

### Fork Sandbox (Experimental)

```python
forked = sandbox._experimental_fork(name="my-forked-sandbox")
```

### Create Snapshot from Sandbox (Experimental)

```python
sandbox._experimental_create_snapshot("my-sandbox-snapshot")
```

### GPU Sandboxes (Experimental, request access)

Must be ephemeral. Create a GPU snapshot first.

---

## Snapshots

Sandbox templates from Docker/OCI images. States: `Pending` → `Building/Pulling` → `Active` / `Inactive` / `Error`

```python
from daytona import Daytona, CreateSnapshotParams
snapshot = daytona.snapshot.create(CreateSnapshotParams(name="my-snapshot", image="python:3.12"))
```

```typescript
const snapshot = await daytona.snapshot.create({
  name: "my-snapshot",
  image: "python:3.12",
})
```

- No `latest` tag — use specific tags (e.g., `python:3.12-slim`)
- Supports: Docker Hub, GHCR, Google Artifact Registry, private OCI registries
- Can run Docker and Kubernetes workloads inside sandboxes

### Default Snapshots available with pre-installed packages (Python pip, Node.js npm)

---

## Declarative Builder

Build images programmatically:

```python
image = (
    Image.debian_slim("3.12")
    .pip_install(["requests", "numpy"])
    .apt_install(["git"])
    .env({"MY_VAR": "value"})
    .workdir("/app")
    .run_commands(["echo 'setup complete'"])
)
```

Methods: `debian_slim()`, `pip_install()`, `npm_install()`, `apt_install()`, `env()`, `workdir()`, `run_commands()`, `copy()`, `from_dockerfile()`

---

## Volumes

Persistent storage shared across sandboxes, backed by S3-compatible object storage.

```python
volume = daytona.volume.get("my-volume", create=True)
daytona.volume.list()
daytona.volume.delete(volume)
```

Multiple sandboxes can mount the same volume simultaneously.

---

## File System Operations

```python
# List files
files = sandbox.fs.list_files("/home/daytona")
# Upload
sandbox.fs.upload_file("/local/path", "/sandbox/path")
# Download
sandbox.fs.download_file("/sandbox/path", "/local/path")
# Delete
sandbox.fs.delete_file("/sandbox/path")
# Find & replace
sandbox.fs.replace_in_files("/path", "old", "new")
# Move
sandbox.fs.move_files("/old", "/new")
# Permissions
sandbox.fs.set_file_permissions("/path", mode="755")
```

---

## Git Operations

```python
sandbox.git.clone("https://github.com/repo.git", "/home/daytona/repo")
status = sandbox.git.status("/home/daytona/repo")  # .current_branch
sandbox.git.create_branch("/path", "feature/new")
sandbox.git.checkout("/path", "feature/new")
sandbox.git.stage_files("/path", ["file.py"])
sandbox.git.commit("/path", "Commit message", "Author", "email@example.com")
sandbox.git.push("/path")
sandbox.git.pull("/path")
```

---

## Process & Code Execution

```python
# Stateless code run
response = sandbox.process.code_run('print("hi")')  # uses language runtime

# Execute command
response = sandbox.process.exec("ls -la")

# Session-based (stateful)
session = sandbox.process.create_session("my-session")
sandbox.process.execute_in_session(session.id, "cd /tmp")
sandbox.process.execute_in_session(session.id, "ls")

# Streaming
sandbox.process.exec("long-running-cmd", on_output=lambda out: print(out.output))
```

---

## PTY (Pseudo Terminal)

```python
pty = sandbox.pty.create(cols=80, rows=24)
pty.send_input("ls\n")
pty.wait_for_completion()
pty.kill()
```

---

## Log Streaming

```python
sandbox.get_logs(on_logs=lambda chunk: print(chunk))
logs = sandbox.get_logs()  # returns all existing logs
```

---

## LSP (Language Server Protocol)

```python
lsp = sandbox.lsp.create_server("python", "/workspace")
lsp.start()
completions = lsp.get_completions("/workspace/file.py", line=10, character=5)
symbols = lsp.get_document_symbols("/workspace/file.py")
lsp.stop()
```

---

## MCP Server

```bash
daytona mcp init claude   # or cursor, windsurf
daytona mcp start
```

---

## Human Access

- **Web Terminal**: browser-based terminal via Dashboard
- **SSH**: `daytona ssh <sandbox-id>`
- **VNC**: graphical desktop for sandboxes with desktop environment
- **VPN Connections**: connect sandboxes to VPN networks
- **Preview**: `{port}-{sandboxId}.{proxy-domain}` for HTTP services

---

## API Endpoints

- Base: `https://app.daytona.io/api`
- Toolbox (per sandbox): `https://proxy.app.daytona.io/toolbox/{sandboxId}/...`

Key endpoints:

```
POST   /api/sandbox                          # create
GET    /api/sandbox                          # list
POST   /api/sandbox/{id}/start
POST   /api/sandbox/{id}/stop
POST   /api/sandbox/{id}/archive
DELETE /api/sandbox/{id}
POST   /api/sandbox/{id}/resize
POST   /api/sandbox/{id}/autostop/{interval}
POST   /api/sandbox/{id}/autoarchive/{interval}
POST   /api/sandbox/{id}/autodelete/{interval}
POST   /api/sandbox/{id}/fork
POST   /api/sandbox/{id}/snapshot

POST   /toolbox/{id}/process/execute
POST   /toolbox/{id}/git/clone
GET    /toolbox/{id}/git/status
POST   /toolbox/{id}/fs/upload
GET    /toolbox/{id}/fs/download
```

---

## Regions

- **Shared**: `us`, `eu` — multi-tenant, cost-effective
- **Dedicated**: isolated infrastructure for an org
- **Custom**: customer-managed runners on own infrastructure

---

## Security / Auth

- API keys from Dashboard or API
- Auth via `Authorization: Bearer YOUR_API_KEY`
- Organization-level multi-tenancy
- Per-sandbox firewall rules; can block all egress
- Audit logs, security exhibit available

---

## Observability

- OpenTelemetry collection endpoint
- Metrics, traces, logs per sandbox in Dashboard
- Webhooks for real-time event notifications

---

## Useful Links

| Resource      | URL                                       |
| ------------- | ----------------------------------------- |
| Dashboard     | https://app.daytona.io                    |
| API Keys      | https://app.daytona.io/dashboard/keys     |
| API Reference | https://www.daytona.io/docs/en/tools/api  |
| CLI Reference | https://www.daytona.io/docs/en/tools/cli  |
| GitHub        | https://github.com/daytonaio/daytona      |
| LLM full docs | https://www.daytona.io/docs/llms-full.txt |
| LLM index     | https://www.daytona.io/docs/llms.txt      |
