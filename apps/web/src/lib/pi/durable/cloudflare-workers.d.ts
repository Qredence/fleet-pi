/**
 * Workers types for the Pi Durable owner only. The TanStack app tsconfig is
 * DOM plus Node, so this does not pull in `@cloudflare/workers-types`.
 */
declare module "cloudflare:workers" {
  export interface DurableObjectId {
    toString: () => string
    readonly name?: string
  }

  export interface DurableObjectState {
    readonly id: DurableObjectId
    readonly storage: {
      readonly sql: {
        exec: (
          query: string,
          ...bindings: Array<ArrayBuffer | string | number | null>
        ) => {
          toArray: () => Array<
            Record<string, ArrayBuffer | string | number | null>
          >
        }
      }
      transaction: <T>(closure: () => Promise<T>) => Promise<T>
    }
    blockConcurrencyWhile: <T>(callback: () => Promise<T>) => Promise<T>
  }

  export class DurableObject<Env = unknown> {
    ctx: DurableObjectState
    env: Env
    constructor(ctx: DurableObjectState, env: Env)
  }

  export const env: {
    USER_PI_DURABLE: {
      getByName: (name: string) => {
        readonly id: { toString: () => string }
        storageOwner: () => Promise<{
          objectId: string
          userId: string | undefined
        }>
        rootConversation: () => Promise<{ rootId: string }>
        scriptedBashEcho: () => Promise<{ rootId: string; transcript: string }>
        restart: () => Promise<{ rootId: string; transcript: string }>
        beginHangingRead: () => Promise<{ reads: number }>
        beginHangingBash: () => Promise<{ bashes: number }>
        replayRead: () => Promise<{ reads: number; rootId: string }>
        replayBash: () => Promise<{ bashes: number; transcript: string }>
        modelOnlyReply: (
          prompt: string
        ) => Promise<{ tools: Array<string>; transcript: string }>
      }
    }
  }
}
