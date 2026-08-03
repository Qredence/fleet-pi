import { describe, expect, it } from "vitest"
import {
  CUSTOM_PROVIDER_ID_PREFIX,
  OCC_INSTANCE_ID_PREFIX,
  isCustomProviderId,
  toCustomProviderId,
  toInstanceSlug,
} from "../provider-catalog"

describe("custom provider ids", () => {
  it("recognizes custom+<slug> ids as the custom provider family", () => {
    expect(isCustomProviderId(`${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`)).toBe(
      true
    )
    expect(isCustomProviderId("custom+")).toBe(true)
    expect(isCustomProviderId("openai-chat-completions")).toBe(false)
    expect(isCustomProviderId(`${OCC_INSTANCE_ID_PREFIX}nebius`)).toBe(false)
    expect(isCustomProviderId("google")).toBe(false)
    expect(isCustomProviderId("customized")).toBe(false)
  })

  it("keeps the prefix stable for wire compatibility", () => {
    expect(CUSTOM_PROVIDER_ID_PREFIX).toBe("custom+")
  })

  it("slugifies display names into stable instance slugs", () => {
    expect(toInstanceSlug("My Endpoint")).toBe("my-endpoint")
    expect(toInstanceSlug("  Nebius AI  ")).toBe("nebius-ai")
    expect(toInstanceSlug("My Provider!! v2")).toBe("my-provider-v2")
    expect(toInstanceSlug("kubernetes/rocks")).toBe("kubernetes-rocks")
  })

  it("falls back to the generic provider slug for empty display names", () => {
    expect(toInstanceSlug("")).toBe("provider")
    expect(toInstanceSlug("!!!")).toBe("provider")
  })

  it("trims long slugs without dangling separators", () => {
    const slug = toInstanceSlug("a".repeat(200) + " b")
    expect(slug.length).toBeLessThanOrEqual(48)
    expect(slug.endsWith("-")).toBe(false)
  })

  it("builds the full custom provider id from a slug", () => {
    expect(toCustomProviderId("my-endpoint")).toBe(
      `${CUSTOM_PROVIDER_ID_PREFIX}my-endpoint`
    )
  })
})
