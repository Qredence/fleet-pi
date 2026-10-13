const NEON_API_BASE = "https://console.neon.tech/api/v2"

type NeonBranchesResponse = {
  branches?: Array<{ id: string; name: string }>
  pagination?: { cursor?: string }
}

type NeonConnectionUriResponse = {
  uri?: string
}

export type ResolvePreviewConnectionUriOptions = {
  projectId: string
  apiKey: string
  branchName: string
  databaseName?: string
  roleName?: string
  pooled?: boolean
}

async function neonApiGet<T>(
  path: string,
  apiKey: string,
  searchParams?: Record<string, string>
): Promise<T> {
  const url = new URL(`${NEON_API_BASE}${path}`)
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value)
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(
      `Neon API ${response.status} for ${path}: ${body.slice(0, 200)}`
    )
  }

  return (await response.json()) as T
}

export async function findNeonBranchIdByName(
  options: ResolvePreviewConnectionUriOptions
): Promise<string | undefined> {
  let cursor: string | undefined

  for (;;) {
    const searchParams: Record<string, string> = { limit: "100" }
    if (cursor) searchParams.cursor = cursor

    const data = await neonApiGet<NeonBranchesResponse>(
      `/projects/${options.projectId}/branches`,
      options.apiKey,
      searchParams
    )

    const match = data.branches?.find(
      (branch) => branch.name === options.branchName
    )
    if (match?.id) return match.id

    cursor = data.pagination?.cursor
    if (!cursor) break
  }

  return undefined
}

export async function fetchNeonConnectionUri(
  options: ResolvePreviewConnectionUriOptions & { branchId: string }
): Promise<string> {
  const data = await neonApiGet<NeonConnectionUriResponse>(
    `/projects/${options.projectId}/connection_uri`,
    options.apiKey,
    {
      branch_id: options.branchId,
      database_name: options.databaseName ?? "neondb",
      role_name: options.roleName ?? "fleet_pi_app",
      pooled: String(options.pooled ?? true),
    }
  )

  const uri = data.uri?.trim() ?? ""
  if (!uri) {
    throw new Error("Neon connection_uri response did not include a URI.")
  }
  return uri
}

export type PollPreviewConnectionUriOptions =
  ResolvePreviewConnectionUriOptions & {
    maxAttempts?: number
    delayMs?: number
    sleep?: (ms: number) => Promise<void>
  }

export async function pollPreviewBranchConnectionUri(
  options: PollPreviewConnectionUriOptions
): Promise<string | undefined> {
  const maxAttempts = options.maxAttempts ?? 30
  const delayMs = options.delayMs ?? 10_000
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const branchId = await findNeonBranchIdByName(options)
    if (branchId) {
      try {
        return await fetchNeonConnectionUri({ ...options, branchId })
      } catch {
        // Branch may exist before connection_uri is ready.
      }
    }
    if (attempt < maxAttempts - 1) {
      await sleep(delayMs)
    }
  }

  return undefined
}
