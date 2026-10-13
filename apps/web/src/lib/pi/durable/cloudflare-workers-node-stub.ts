/** Vite SSR stub for `cloudflare:workers` when the Worker entry is loaded in Node. */
export class DurableObject<Env = unknown> {
  ctx: unknown
  env: Env

  constructor(ctx: unknown, env: Env) {
    this.ctx = ctx
    this.env = env
  }
}
