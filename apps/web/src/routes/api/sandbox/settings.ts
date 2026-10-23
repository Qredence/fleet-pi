import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { getErrorMessage } from "@/lib/pi/server"
import { isEnvVarConfigured, updateEnvVar } from "@/lib/env-manager"
import { withAuthenticatedChatRequest } from "@/lib/auth/chat-api-auth"
import { issueCsrfToken, validateCsrfRequest } from "@/lib/auth/csrf"
import { isHostedDeployment } from "@/lib/deployment/environment"
import { readHostedSandboxStatus } from "@/lib/pi/durable/durable-sandbox"
import { getCachedUserSandbox, getVolumeName } from "@/lib/daytona/user-sandbox"
import { resolveDaytonaRuntimeApiKey } from "@/lib/pi/runtime/user-provider-secrets"

const SandboxSettingsUpdateSchema = z.object({
  daytonaApiKey: z.string().optional(),
  daytonaTarget: z.string().optional(),
})

export const Route = createFileRoute("/api/sandbox/settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return await withAuthenticatedChatRequest(
            request,
            async ({ userId }) => {
              if (isHostedDeployment()) {
                if (!userId) {
                  return Response.json(
                    { message: "Unauthorized" },
                    { status: 401 }
                  )
                }
                const status = await readHostedSandboxStatus(userId)
                return Response.json({
                  daytonaApiKeyConfigured: status.keyPresent,
                  daytonaTargetConfigured: false,
                  daytonaTarget: "",
                  sandboxReady: status.sandboxReady,
                  volumeName: status.volumeName,
                })
              }

              const effectiveUserId = userId || "anonymous"
              const cached = getCachedUserSandbox(effectiveUserId)
              const daytonaApiKeyConfigured =
                isEnvVarConfigured("DAYTONA_API_KEY") ||
                Boolean(await resolveDaytonaRuntimeApiKey(effectiveUserId))
              const csrf = issueCsrfToken(request)
              return Response.json(
                {
                  daytonaApiKeyConfigured,
                  daytonaTargetConfigured: isEnvVarConfigured("DAYTONA_TARGET"),
                  daytonaTarget: process.env.DAYTONA_TARGET || "",
                  sandboxReady: Boolean(cached?.sandboxId),
                  volumeName: getVolumeName(effectiveUserId),
                  csrfToken: csrf.token,
                },
                {
                  headers: { "Set-Cookie": csrf.cookie },
                }
              )
            }
          )
        } catch (error) {
          return Response.json(
            { message: getErrorMessage(error) },
            { status: getResponseStatus(error) }
          )
        }
      },
      POST: async ({ request }) => {
        try {
          return await withAuthenticatedChatRequest(request, async () => {
            const rawBody = await request.json()
            const body = SandboxSettingsUpdateSchema.parse(rawBody)

            if (isHostedDeployment()) {
              return Response.json(
                { message: "Not supported on Cloudflare" },
                { status: 400 }
              )
            } else {
              const csrf = validateCsrfRequest(request)
              if (!csrf.ok) {
                return Response.json(
                  { message: "Invalid CSRF protection" },
                  { status: 403 }
                )
              }
              const context = resolveAppRuntimeContext()
              if (body.daytonaApiKey !== undefined) {
                await updateEnvVar(
                  context.projectRoot,
                  "DAYTONA_API_KEY",
                  body.daytonaApiKey
                )
              }
              if (body.daytonaTarget !== undefined) {
                await updateEnvVar(
                  context.projectRoot,
                  "DAYTONA_TARGET",
                  body.daytonaTarget
                )
              }
            }

            return Response.json({
              success: true,
              daytonaApiKeyConfigured: isEnvVarConfigured("DAYTONA_API_KEY"),
              daytonaTargetConfigured: isEnvVarConfigured("DAYTONA_TARGET"),
              daytonaTarget: process.env.DAYTONA_TARGET || "",
            })
          })
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
