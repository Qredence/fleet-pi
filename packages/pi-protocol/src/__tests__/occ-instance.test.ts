import { describe, expect, it } from "vitest"
import {
  OCC_INSTANCE_ID_PREFIX,
  OPENAI_CHAT_COMPLETIONS_PROVIDER_ID,
  isNamedOccInstanceId,
  isOccProviderId,
  toOccInstanceId,
  toOccInstanceSlug,
} from "../provider-catalog"

describe("OCC instance ids", () => {
  it("recognizes the reserved default and named instance ids as OCC family", () => {
    expect(isOccProviderId(OPENAI_CHAT_COMPLETIONS_PROVIDER_ID)).toBe(true)
    expect(isOccProviderId(`${OCC_INSTANCE_ID_PREFIX}nebius`)).toBe(true)
    expect(isOccProviderId("openai")).toBe(false)
    expect(isOccProviderId("google")).toBe(false)
    expect(isOccProviderId("openai-chat-completions-base-url")).toBe(false)
  })

  it("distinguishes the reserved default from named instances", () => {
    expect(isNamedOccInstanceId(OPENAI_CHAT_COMPLETIONS_PROVIDER_ID)).toBe(
      false
    )
    expect(isNamedOccInstanceId(`${OCC_INSTANCE_ID_PREFIX}nebius`)).toBe(true)
  })

  it("slugifies display names into stable ids", () => {
    expect(toOccInstanceSlug("OpenCode Zen")).toBe("opencode-zen")
    expect(toOccInstanceSlug("  Nebius AI  ")).toBe("nebius-ai")
    expect(toOccInstanceSlug("My Provider!! v2")).toBe("my-provider-v2")
    expect(toOccInstanceSlug("kubernetes/rocks")).toBe("kubernetes-rocks")
    expect(toOccInstanceSlug("")).toBe("occ")
    expect(toOccInstanceSlug("!!!")).toBe("occ")
  })

  it("trims long slugs without dangling separators", () => {
    const slug = toOccInstanceSlug("a".repeat(200) + " b")
    expect(slug.length).toBeLessThanOrEqual(48)
    expect(slug.endsWith("-")).toBe(false)
  })

  it("builds the full instance id from a slug", () => {
    expect(toOccInstanceId("opencode-zen")).toBe(
      `${OCC_INSTANCE_ID_PREFIX}opencode-zen`
    )
  })
})
