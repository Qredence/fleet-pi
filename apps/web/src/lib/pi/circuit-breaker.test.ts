import { describe, expect, it } from "vitest"
import CircuitBreaker from "opossum"
import {
  BEDROCK_CIRCUIT_BREAKER_OPTIONS,
  createBedrockCircuitBreaker,
  createBedrockFallbackError,
} from "./circuit-breaker"

describe("circuit-breaker configuration", () => {
  it("exports configured options with required thresholds", () => {
    expect(BEDROCK_CIRCUIT_BREAKER_OPTIONS.errorThresholdPercentage).toBe(50)
    expect(BEDROCK_CIRCUIT_BREAKER_OPTIONS.resetTimeout).toBe(30_000)
    expect(BEDROCK_CIRCUIT_BREAKER_OPTIONS.volumeThreshold).toBe(5)
    expect(BEDROCK_CIRCUIT_BREAKER_OPTIONS.timeout).toBe(30_000)
    expect(BEDROCK_CIRCUIT_BREAKER_OPTIONS.name).toBe("bedrock-api")
  })

  it("creates a CircuitBreaker instance with correct options", () => {
    const fn = () => Promise.resolve("ok")
    const breaker = createBedrockCircuitBreaker(fn)
    expect(breaker).toBeInstanceOf(CircuitBreaker)
    expect(breaker.name).toBe("bedrock-api")
    expect(breaker.volumeThreshold).toBe(5)
  })
})

describe("circuit-breaker tripping behavior", () => {
  it("transitions to open state after consecutive failures exceed threshold", async () => {
    let callCount = 0
    const failingFn = () => {
      callCount++
      return Promise.reject(new Error("Bedrock failure"))
    }

    // Use a custom breaker with low thresholds for fast testing
    const breaker = new CircuitBreaker(failingFn, {
      errorThresholdPercentage: 50,
      resetTimeout: 1000,
      volumeThreshold: 3,
      rollingCountTimeout: 100,
      rollingCountBuckets: 1,
    })

    // Fire enough times to exceed volume threshold and failure rate
    for (let i = 0; i < 5; i++) {
      try {
        await breaker.fire()
      } catch {
        // expected to fail
      }
    }

    expect(breaker.opened).toBe(true)
    // Once the circuit is open, subsequent calls should not reach the function
    const callsBeforeOpen = callCount

    try {
      await breaker.fire()
    } catch {
      // expected to fail
    }

    expect(callCount).toBe(callsBeforeOpen)
  })

  it("emits an open event when the circuit trips", async () => {
    let openEventFired = false
    const failingFn = () => {
      return Promise.reject(new Error("Bedrock failure"))
    }

    const breaker = new CircuitBreaker(failingFn, {
      errorThresholdPercentage: 50,
      resetTimeout: 1000,
      volumeThreshold: 2,
      rollingCountTimeout: 100,
      rollingCountBuckets: 1,
    })

    breaker.on("open", () => {
      openEventFired = true
    })

    for (let i = 0; i < 4; i++) {
      try {
        await breaker.fire()
      } catch {
        // expected
      }
    }

    expect(openEventFired).toBe(true)
    expect(breaker.opened).toBe(true)
  })
})

describe("circuit-breaker fallback behavior", () => {
  it("returns fallback error when circuit is manually opened", async () => {
    const fn = () => Promise.resolve("should not reach")
    const breaker = createBedrockCircuitBreaker(fn)
    breaker.fallback(() => {
      throw createBedrockFallbackError()
    })

    breaker.open()

    await expect(breaker.fire()).rejects.toThrow(
      "Bedrock API is temporarily unavailable"
    )
  })

  it("returns fallback error after the circuit auto-trips", async () => {
    const failingFn = () => {
      return Promise.reject(new Error("Bedrock failure"))
    }

    const breaker = new CircuitBreaker(failingFn, {
      errorThresholdPercentage: 50,
      resetTimeout: 1000,
      volumeThreshold: 2,
      rollingCountTimeout: 100,
      rollingCountBuckets: 1,
    })

    breaker.fallback(() => {
      throw createBedrockFallbackError()
    })

    for (let i = 0; i < 4; i++) {
      try {
        await breaker.fire()
      } catch {
        // expected
      }
    }

    expect(breaker.opened).toBe(true)
    await expect(breaker.fire()).rejects.toThrow(
      "Bedrock API is temporarily unavailable"
    )
  })

  it("fallback preserves the error message format", () => {
    const error = createBedrockFallbackError()
    expect(error.message).toContain("Bedrock API is temporarily unavailable")
    expect(error.message).toContain("repeated failures")
    expect(error.message).toContain("try again later")
  })
})
