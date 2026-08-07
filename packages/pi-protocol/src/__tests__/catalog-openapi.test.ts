import { describe, expect, it } from "vitest"
import { getOpenApiMetadata } from "@asteasolutions/zod-to-openapi"
import {
  ChatCommandsResponseSchema,
  ChatSlashCommandInfoSchema,
} from "../chat-protocol.zod"

describe("catalog slash-command schemas", () => {
  it("ChatSlashCommandInfoSchema carries openapi description metadata", () => {
    expect(
      getOpenApiMetadata(ChatSlashCommandInfoSchema).description
    ).toBeTruthy()
  })

  it("ChatCommandsResponseSchema carries openapi description metadata", () => {
    expect(
      getOpenApiMetadata(ChatCommandsResponseSchema).description
    ).toBeTruthy()
  })

  it("ChatCommandsResponseSchema parses a valid payload", () => {
    const result = ChatCommandsResponseSchema.safeParse({
      commands: [
        {
          name: "model",
          description: "Open the model picker",
          source: "builtin",
        },
        { name: "fleet-pi-orientation", source: "skill", passThrough: true },
      ],
      diagnostics: [],
    })

    expect(result.success).toBe(true)
  })

  it("ChatSlashCommandInfoSchema rejects an invalid source", () => {
    const result = ChatSlashCommandInfoSchema.safeParse({
      name: "model",
      source: "unknown",
    })

    expect(result.success).toBe(false)
  })
})
