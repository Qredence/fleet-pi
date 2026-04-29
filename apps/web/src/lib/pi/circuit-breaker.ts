import CircuitBreaker from "opossum"

export const BEDROCK_CIRCUIT_BREAKER_OPTIONS = {
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 5,
  timeout: 30_000,
  name: "bedrock-api",
} as const

export type BedrockCircuitBreakerOptions =
  typeof BEDROCK_CIRCUIT_BREAKER_OPTIONS

export function createBedrockCircuitBreaker<
  TI extends Array<unknown> = Array<unknown>,
  TR = unknown,
>(fn: (...args: TI) => Promise<TR>): CircuitBreaker<TI, TR> {
  return new CircuitBreaker(fn, BEDROCK_CIRCUIT_BREAKER_OPTIONS)
}

export function createBedrockFallbackError(): Error {
  return new Error(
    "Bedrock API is temporarily unavailable due to repeated failures. " +
      "Please try again later."
  )
}
