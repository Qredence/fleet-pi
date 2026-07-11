import { createFileRoute } from "@tanstack/react-router"
import {
  ChatProviderUpdateRequestSchema,
  ChatProviderUpdateResponseSchema,
} from "@workspace/hax-design/lib/pi/chat-protocol.zod"
import { KNOWN_PROVIDERS } from "@workspace/hax-design/lib/pi/provider-catalog"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { getErrorMessage } from "@/lib/pi/server"
import { updateEnvVar } from "@/lib/env-manager"
import { auth } from "@/lib/auth/server"
import { encryptString } from "@/lib/auth/crypto"
import { upsertUserProviderEncryptedKey } from "@/lib/db/user-providers"
import { refreshSandboxProviderCredentials } from "@/lib/daytona/refresh-sandbox-credentials"
import {
  getProviderConfigStatus,
  hotReloadActiveRuntimesForUser,
  hotReloadProviderAuthForActiveRuntimes,
} from "@/lib/pi/runtime"

export const Route = createFileRoute("/api/chat/providers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const authSession = await auth.api
            .getSession({ headers: request.headers })
            .catch(() => null)

          const providers = await getProviderConfigStatus({
            userId: authSession?.user.id,
          })
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

          if (provider.authType === "oauth") {
            return Response.json(
              {
                message: `${provider.name} uses OAuth and cannot be configured with an API key here.`,
              },
              { status: 400 }
            )
          }

          const authSession = await auth.api
            .getSession({ headers: request.headers })
            .catch(() => null)
          const userId = authSession?.user.id

          if (process.env.VERCEL === "1") {
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
            await upsertUserProviderEncryptedKey(
              userId,
              provider.id,
              encryptedKey
            )
          } else {
            const context = resolveAppRuntimeContext()
            await updateEnvVar(
              context.projectRoot,
              provider.envVarName,
              body.apiKey
            )
          }

          if (userId) {
            await hotReloadActiveRuntimesForUser(userId)
            // Best-effort: push updated keys into a live Daytona sandbox.
            try {
              await refreshSandboxProviderCredentials(userId)
            } catch {
              // Sandbox may be offline or disabled; credentials still saved.
            }
          } else {
            await hotReloadProviderAuthForActiveRuntimes()
          }

          const updatedProviders = await getProviderConfigStatus({ userId })

          const response = ChatProviderUpdateResponseSchema.parse({
            success: true,
            providers: updatedProviders,
            reloadRequired: false,
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
