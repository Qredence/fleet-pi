import { createFileRoute } from "@tanstack/react-router"
import {
  ChatProviderUpdateRequestSchema,
  ChatProviderUpdateResponseSchema,
} from "@workspace/hax-design/lib/pi/chat-protocol.zod"
import type { ChatProviderInfo } from "@workspace/hax-design/lib/pi/chat-protocol"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { getErrorMessage } from "@/lib/pi/server"
import { isEnvVarConfigured, updateEnvVar } from "@/lib/env-manager"
import { auth } from "@/lib/auth/server"
import { encryptString } from "@/lib/auth/crypto"
import { withChatPostgresTransaction } from "@/lib/db/pi-session-mirror"

export const KNOWN_PROVIDERS = [
  // Note: AWS_REGION alone doesn't indicate credentials are configured.
  // We check AWS_ACCESS_KEY_ID as a best-effort heuristic; actual auth is verified at runtime.
  {
    id: "amazon-bedrock",
    name: "Amazon Bedrock",
    envVarName: "AWS_ACCESS_KEY_ID",
  },
  { id: "openai", name: "OpenAI", envVarName: "OPENAI_API_KEY" },
  { id: "anthropic", name: "Anthropic", envVarName: "ANTHROPIC_API_KEY" },
  {
    id: "google-vertex",
    name: "Google Vertex",
    envVarName: "GOOGLE_APPLICATION_CREDENTIALS",
  },
  { id: "google-genai", name: "Google Gemini", envVarName: "GEMINI_API_KEY" },
  { id: "mistral", name: "Mistral", envVarName: "MISTRAL_API_KEY" },
  { id: "groq", name: "Groq", envVarName: "GROQ_API_KEY" },
  { id: "ollama", name: "Ollama", envVarName: "OLLAMA_BASE_URL" },
  { id: "daytona", name: "Daytona", envVarName: "DAYTONA_API_KEY" },
  {
    id: "daytona-target",
    name: "Daytona Target",
    envVarName: "DAYTONA_TARGET",
  },
]

async function getProviderConfigStatus(
  userId?: string
): Promise<Array<ChatProviderInfo>> {
  if (process.env.VERCEL !== "1") {
    // Local: Use .env
    return KNOWN_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      envVarName: p.envVarName,
      isConfigured: isEnvVarConfigured(p.envVarName),
    }))
  }

  // Vercel: Use DB
  if (!userId) {
    return KNOWN_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      envVarName: p.envVarName,
      isConfigured: false,
    }))
  }

  const configuredProviderIds = new Set<string>()
  await withChatPostgresTransaction(async (client: any) => {
    const res = await client.query(
      "SELECT provider_id FROM pi_user_providers WHERE user_id = $1",
      [userId]
    )
    for (const row of res.rows) {
      configuredProviderIds.add(row.provider_id)
    }
  }, userId)

  return KNOWN_PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    envVarName: p.envVarName,
    isConfigured: configuredProviderIds.has(p.id),
  }))
}

export const Route = createFileRoute("/api/chat/providers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const authSession = await auth.api
            .getSession({ headers: request.headers })
            .catch(() => null)

          const providers = await getProviderConfigStatus(authSession?.user.id)
          return Response.json({ providers })
        } catch (error) {
          return Response.json(
            { message: getErrorMessage(error) },
            { status: getResponseStatus(error) }
          )
        }
      },
      POST: async ({ request }) => {
        try {
          const rawBody = await request.json()
          const body = ChatProviderUpdateRequestSchema.parse(rawBody)
          const provider = KNOWN_PROVIDERS.find((p) => p.id === body.providerId)
          if (!provider) {
            return Response.json(
              { message: "Unknown provider" },
              { status: 400 }
            )
          }

          const authSession = await auth.api
            .getSession({ headers: request.headers })
            .catch(() => null)
          const userId = authSession?.user.id

          if (process.env.VERCEL === "1") {
            // Vercel: Save to DB
            if (!userId) {
              return Response.json({ message: "Unauthorized" }, { status: 401 })
            }
            if (!process.env.BETTER_AUTH_SECRET) {
              throw new Error(
                "BETTER_AUTH_SECRET is required to encrypt provider keys."
              )
            }
            const encryptedKey = encryptString(
              body.apiKey,
              process.env.BETTER_AUTH_SECRET
            )
            await withChatPostgresTransaction(async (client: any) => {
              await client.query(
                `
                INSERT INTO pi_user_providers (user_id, provider_id, encrypted_key, updated_at)
                VALUES ($1, $2, $3, now())
                ON CONFLICT (user_id, provider_id)
                DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key, updated_at = EXCLUDED.updated_at
              `,
                [userId, provider.id, encryptedKey]
              )
            }, userId)
          } else {
            // Local: Save to .env.local
            const context = resolveAppRuntimeContext()
            await updateEnvVar(
              context.projectRoot,
              provider.envVarName,
              body.apiKey
            )
          }

          const updatedProviders = await getProviderConfigStatus(userId)

          // Note: AWS SDK clients resolve credentials at construction time.
          // Updating env vars mid-process may not be picked up by existing Pi runtime sessions.
          const response = ChatProviderUpdateResponseSchema.parse({
            success: true,
            providers: updatedProviders,
            reloadRequired: true,
          })
          return Response.json(response)
        } catch (error) {
          return Response.json(
            { message: getErrorMessage(error) },
            { status: getResponseStatus(error) }
          )
        }
      },
    },
  },
})
