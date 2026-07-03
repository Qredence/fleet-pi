import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { getResponseStatus, resolveAppRuntimeContext } from "@/lib/app-runtime"
import { getErrorMessage } from "@/lib/pi/server"
import { isEnvVarConfigured, updateEnvVar } from "@/lib/env-manager"
import { auth } from "@/lib/auth/server"

const SandboxSettingsUpdateSchema = z.object({
  daytonaApiKey: z.string().optional(),
  daytonaTarget: z.string().optional(),
})

export const Route = createFileRoute("/api/sandbox/settings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const session = await auth.api
            .getSession({ headers: request.headers })
            .catch(() => null)

          if (!session) {
            return Response.json({ message: "Unauthorized" }, { status: 401 })
          }

          if (process.env.VERCEL === "1") {
            return Response.json({
              daytonaApiKeyConfigured: false,
              daytonaTargetConfigured: false,
              daytonaTarget: "",
            })
          }

          return Response.json({
            daytonaApiKeyConfigured: isEnvVarConfigured("DAYTONA_API_KEY"),
            daytonaTargetConfigured: isEnvVarConfigured("DAYTONA_TARGET"),
            daytonaTarget: process.env.DAYTONA_TARGET || "", // Return the target if we want to show it
          })
        } catch (error) {
          return Response.json(
            { message: getErrorMessage(error) },
            { status: getResponseStatus(error) }
          )
        }
      },
      POST: async ({ request }) => {
        try {
          const session = await auth.api
            .getSession({ headers: request.headers })
            .catch(() => null)

          if (!session) {
            return Response.json({ message: "Unauthorized" }, { status: 401 })
          }

          const rawBody = await request.json()
          const body = SandboxSettingsUpdateSchema.parse(rawBody)

          if (process.env.VERCEL === "1") {
            return Response.json(
              { message: "Not supported on Vercel" },
              { status: 400 }
            )
          } else {
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
