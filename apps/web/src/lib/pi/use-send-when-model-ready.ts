import { useCallback, useEffect, useRef } from "react"

export type ModelPickerReadiness = {
  /** React Query status of the chat models request. */
  status: "pending" | "error" | "success"
  modelCount: number
  hasSelection: boolean
}

/**
 * The composer may send once the model picker has settled: models loaded and
 * a model selected (or nothing to select), or the models request failed — in
 * which case the server resolves the default model itself.
 */
export function isModelPickerReady({
  status,
  modelCount,
  hasSelection,
}: ModelPickerReadiness): boolean {
  if (status === "error") return true
  if (status !== "success") return false
  return modelCount === 0 || hasSelection
}

type Pending<TInput> = {
  input: TInput
  resolve: () => void
  reject: (error: unknown) => void
}

/**
 * Wraps `send` so input submitted before the model picker is ready is held
 * and dispatched (with the then-current model selection) once it is, instead
 * of going out with no model. Like `sendMessage` while a turn is submitted,
 * further submits during the hold are ignored (resolved without sending) so
 * the first message is the one that goes out.
 */
export function useSendWhenModelReady<TInput>(
  send: (input: TInput) => Promise<void>,
  ready: boolean
): (input: TInput) => Promise<void> {
  const pendingRef = useRef<Pending<TInput> | null>(null)
  // Latest values via refs so a stale callback captured by a child (e.g. a
  // memoized composer handler) still sees readiness and the current sender.
  const readyRef = useRef(ready)
  const sendRef = useRef(send)
  readyRef.current = ready
  sendRef.current = send

  useEffect(() => {
    if (!ready) return
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    sendRef.current(pending.input).then(pending.resolve, pending.reject)
  }, [ready, send])

  return useCallback((input: TInput) => {
    if (readyRef.current) return sendRef.current(input)
    if (pendingRef.current) return Promise.resolve()
    return new Promise<void>((resolve, reject) => {
      pendingRef.current = { input, resolve, reject }
    })
  }, [])
}
