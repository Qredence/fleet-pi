import CircuitBreaker from "opossum"

export const SESSION_CIRCUIT_BREAKER_OPTIONS = {
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 5,
  timeout: 30_000,
  name: "session-creation-api",
} as const

export function createSessionCircuitBreaker<
  TI extends Array<unknown> = Array<unknown>,
  TR = unknown,
>(fn: (...args: TI) => Promise<TR>): CircuitBreaker<TI, TR> {
  return new CircuitBreaker(fn, SESSION_CIRCUIT_BREAKER_OPTIONS)
}

export function createSessionFallbackError(): Error {
  return new Error(
    "Session creation is temporarily unavailable due to repeated failures. " +
      "Please try again later."
  )
}
