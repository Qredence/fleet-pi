import { createFileRoute } from "@tanstack/react-router"
import type { ChatProviderInfo } from "@/lib/pi/chat-protocol"
import {
  ChatProviderUpdateRequestSchema,
  ChatProviderUpdateResponseSchema,
} from "@/lib/pi/chat-protocol.zod"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { getErrorMessage } from "@/lib/pi/server"
import { isEnvVarConfigured, updateEnvVar } from "@/lib/env-manager"

const KNOWN_PROVIDERS = [
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
]

export const Route = createFileRoute("/api/chat/providers")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const providers: Array<ChatProviderInfo> = KNOWN_PROVIDERS.map(
            (p) => ({
              id: p.id,
              name: p.name,
              envVarName: p.envVarName,
              isConfigured: isEnvVarConfigured(p.envVarName),
            })
          )
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

          const context = resolveAppRuntimeContext()
          await updateEnvVar(
            context.projectRoot,
            provider.envVarName,
            body.apiKey
          )

          const updatedProviders: Array<ChatProviderInfo> = KNOWN_PROVIDERS.map(
            (p) => ({
              id: p.id,
              name: p.name,
              envVarName: p.envVarName,
              isConfigured: isEnvVarConfigured(p.envVarName),
            })
          )

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
