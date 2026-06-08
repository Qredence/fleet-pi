import { describe, expect, it } from "vitest"

// Test barrel exports to ensure all server functions are properly exported
describe("server barrel exports", () => {
  it("exports all required functions", async () => {
    const server = await import("./server")

    // Catalog functions
    expect(typeof server.loadChatModels).toBe("function")
    expect(typeof server.loadChatResources).toBe("function")

    // Settings functions
    expect(typeof server.loadChatSettings).toBe("function")
    expect(typeof server.updateChatSettings).toBe("function")

    // Runtime functions
    expect(typeof server.abortActiveSession).toBe("function")
    expect(typeof server.answerChatQuestion).toBe("function")
    expect(typeof server.createPiRuntime).toBe("function")
    expect(typeof server.queuePromptOnActiveSession).toBe("function")
    expect(typeof server.retainPiRuntime).toBe("function")

    // Session functions
    expect(typeof server.createNewChatSession).toBe("function")
    expect(typeof server.hydrateChatSession).toBe("function")
    expect(typeof server.listChatSessions).toBe("function")

    // Shared functions
    expect(typeof server.encodeEvent).toBe("function")
    expect(typeof server.getErrorMessage).toBe("function")
  })
})
