export type SandboxRuntimeStatus = {
  keyPresent: boolean
  sandboxReady: boolean
  volumeName: string
}

export function nextSandboxRuntimeStatus(
  current: SandboxRuntimeStatus | null,
  next: SandboxRuntimeStatus | null | undefined
) {
  return next == null ? current : next
}
