import { zipSync } from "fflate"

import { withNumberSuffix } from "@/lib/optimize"

/** Where optimized files go: a folder on disk, or a zip download as a fallback. */
export type SaveTarget = {
  /** Saves the file and resolves with the name it was actually saved under. */
  save(name: string, blob: Blob): Promise<string>
  /** Called once after the last save. */
  finish(): Promise<void>
}

export function supportsFolderPicker() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window
}

/**
 * Opens the OS folder picker. Must be called from a click (user gesture).
 * Resolves null if the user cancels.
 */
export async function pickFolder() {
  try {
    const dir = await window.showDirectoryPicker?.({
      id: "image-optimizer-output",
      mode: "readwrite",
      startIn: "pictures",
    })
    return dir ?? null
  } catch (error) {
    if (isDomError(error, "AbortError")) return null
    throw error
  }
}

export async function ensureWritePermission(dir: FileSystemDirectoryHandle) {
  const descriptor = { mode: "readwrite" } as const
  if ((await dir.queryPermission(descriptor)) === "granted") return true
  return (await dir.requestPermission(descriptor)) === "granted"
}

/** Writes straight into `dir`. Never overwrites: clashes get a -1, -2… suffix. */
export function createFolderTarget(dir: FileSystemDirectoryHandle): SaveTarget {
  const claimed = new Set<string>()

  async function exists(name: string) {
    try {
      await dir.getFileHandle(name)
      return true
    } catch (error) {
      if (isDomError(error, "NotFoundError")) return false
      // A folder with that name exists.
      if (isDomError(error, "TypeMismatchError")) return true
      throw error
    }
  }

  async function claimName(name: string) {
    for (let n = 0; ; n++) {
      const candidate = n === 0 ? name : withNumberSuffix(name, n)
      if (claimed.has(candidate)) continue
      // Claim before awaiting so parallel saves can't pick the same name.
      claimed.add(candidate)
      if (!(await exists(candidate))) return candidate
    }
  }

  return {
    async save(name, blob) {
      const finalName = await claimName(name)
      const handle = await dir.getFileHandle(finalName, { create: true })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return finalName
    },
    async finish() {},
  }
}

/** Collects files in memory and downloads them as one zip at the end. */
export function createZipTarget(zipName: string): SaveTarget {
  const entries: Record<string, Uint8Array> = {}

  return {
    async save(name, blob) {
      const bytes = new Uint8Array(await blob.arrayBuffer())
      // No awaits between choosing the name and storing it, so parallel saves can't clash.
      let finalName = name
      for (let n = 1; finalName in entries; n++) finalName = withNumberSuffix(name, n)
      entries[finalName] = bytes
      return finalName
    },
    async finish() {
      if (Object.keys(entries).length === 0) return
      // Images are already compressed; storing them (level 0) is much faster.
      const zip = zipSync(entries, { level: 0 })
      downloadBlob(new Blob([zip], { type: "application/zip" }), zipName)
    },
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function isDomError(error: unknown, name: string) {
  return error instanceof DOMException && error.name === name
}
