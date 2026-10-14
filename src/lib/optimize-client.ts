import type { OptimizeSettings } from "@/lib/optimize"

export type OptimizedImage = { blob: Blob; width: number; height: number }

/** Sends one file to /api/optimize and returns the optimized image. */
export async function optimizeOnServer(
  file: File,
  settings: OptimizeSettings
): Promise<OptimizedImage> {
  const body = new FormData()
  body.append("file", file)
  body.append("format", settings.format)
  body.append("strength", String(settings.strength))
  if (settings.resize) body.append("longEdge", String(settings.longEdge))

  let response: Response
  try {
    response = await fetch("/api/optimize", { method: "POST", body })
  } catch {
    throw new Error("Couldn't reach the optimizer")
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(payload?.error ?? `Optimizer failed (${response.status})`)
  }

  return {
    blob: await response.blob(),
    width: Number(response.headers.get("X-Output-Width")),
    height: Number(response.headers.get("X-Output-Height")),
  }
}

/**
 * Runs `worker` over `items` with at most `limit` in flight at once.
 * `worker` should handle its own errors.
 */
export async function runPool<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  let next = 0
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await worker(items[next++])
  })
  await Promise.all(lanes)
}
