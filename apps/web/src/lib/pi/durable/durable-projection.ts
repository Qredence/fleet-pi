export async function projectDurableTurn(
  project: () => Promise<void>
): Promise<void> {
  try {
    await project()
  } catch {
    return
  }
}
