import { describe, expect, it } from "vitest"
import { DURABLE_SPIKE_PATH, handleDurableSpikeRequest } from "../spike-route"

function spikeRequest(method = "POST") {
  return new Request(`https://fleet-pi.example${DURABLE_SPIKE_PATH}`, {
    method,
  })
}

describe("handleDurableSpikeRequest", () => {
  it("is not served unless FLEET_PI_DURABLE_SPIKE=1", async () => {
    expect(await handleDurableSpikeRequest(spikeRequest(), {})).toBeNull()
    expect(
      await handleDurableSpikeRequest(spikeRequest(), {
        FLEET_PI_DURABLE_SPIKE: "true",
      })
    ).toBeNull()
    expect(
      await handleDurableSpikeRequest(spikeRequest(), undefined)
    ).toBeNull()
  })

  it("is served when the deploy opts in", async () => {
    const response = await handleDurableSpikeRequest(spikeRequest("GET"), {
      FLEET_PI_DURABLE_SPIKE: "1",
    })
    expect(response?.status).toBe(405)
  })

  it("ignores other paths", async () => {
    const request = new Request("https://fleet-pi.example/api/chat", {
      method: "POST",
    })
    expect(
      await handleDurableSpikeRequest(request, { FLEET_PI_DURABLE_SPIKE: "1" })
    ).toBeNull()
  })
})
