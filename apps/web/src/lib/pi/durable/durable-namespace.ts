import { readBoundWorkerEnv } from "../../runtime/request-scope"

export type DurableNamespace = {
  getByName: (name: string) => {
    fetch: (input: Request) => Promise<Response>
  }
}

/** The bound `USER_PI_DURABLE` namespace, or undefined off Workers. */
export function readDurableNamespace(): DurableNamespace | undefined {
  const env = readBoundWorkerEnv()
  if (!env || !("USER_PI_DURABLE" in env)) return undefined
  const binding = env.USER_PI_DURABLE
  if (!binding || typeof binding !== "object" || !("getByName" in binding)) {
    return undefined
  }
  return binding as DurableNamespace
}
