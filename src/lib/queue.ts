export type QueueStatus = "queued" | "processing" | "done" | "error"

export type QueueResult = {
  name: string
  size: number
  width: number
  height: number
}

export type QueueItem = {
  id: string
  file: File
  /** Object URL for the thumbnail. Revoke it when the item is removed. */
  previewUrl: string
  /** Known once the thumbnail loads. Formats the browser can't show (TIFF) stay unknown. */
  dimensions?: { width: number; height: number }
  status: QueueStatus
  error?: string
  result?: QueueResult
}

export type QueueAction =
  | { type: "add"; items: QueueItem[] }
  | { type: "remove"; id: string }
  | { type: "clear" }
  | { type: "dimensions"; id: string; width: number; height: number }
  | { type: "processing"; id: string }
  | { type: "done"; id: string; result: QueueResult }
  | { type: "failed"; id: string; error: string }
  | { type: "requeue-all" }

export function queueReducer(items: QueueItem[], action: QueueAction): QueueItem[] {
  switch (action.type) {
    case "add":
      return [...items, ...action.items]
    case "remove":
      return items.filter((item) => item.id !== action.id)
    case "clear":
      return []
    case "dimensions": {
      const { id, width, height } = action
      const current = items.find((item) => item.id === id)?.dimensions
      if (current?.width === width && current.height === height) return items
      return update(items, id, { dimensions: { width, height } })
    }
    case "processing":
      return update(items, action.id, {
        status: "processing",
        error: undefined,
        result: undefined,
      })
    case "done":
      return update(items, action.id, { status: "done", result: action.result })
    case "failed":
      return update(items, action.id, { status: "error", error: action.error })
    case "requeue-all":
      return items.map((item) => ({
        ...item,
        status: "queued",
        error: undefined,
        result: undefined,
      }))
  }
}

function update(items: QueueItem[], id: string, patch: Partial<QueueItem>) {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item))
}

let nextId = 0

export function createQueueItem(file: File): QueueItem {
  return {
    id: `item-${++nextId}`,
    file,
    previewUrl: URL.createObjectURL(file),
    status: "queued",
  }
}

/** Identifies the same file dropped twice. */
export function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`
}

/** Waiting to run: never processed, or failed last time. */
export function isPending(item: QueueItem) {
  return item.status === "queued" || item.status === "error"
}
