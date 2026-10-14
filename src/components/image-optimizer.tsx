"use client"

import { useReducer, useState, useSyncExternalStore } from "react"
import { Loader2Icon, RotateCcwIcon, SparklesIcon } from "lucide-react"
import { toast } from "sonner"

import { Dropzone } from "@/components/dropzone"
import { FileList } from "@/components/file-list"
import { SettingsPanel } from "@/components/settings-panel"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  DEFAULT_SETTINGS,
  formatBytes,
  outputFileName,
  type OptimizeSettings,
} from "@/lib/optimize"
import { optimizeOnServer, runPool } from "@/lib/optimize-client"
import { createQueueItem, fileKey, isPending, queueReducer } from "@/lib/queue"
import {
  createFolderTarget,
  createZipTarget,
  ensureWritePermission,
  pickFolder,
  supportsFolderPicker,
} from "@/lib/save-targets"
import { cn } from "@/lib/utils"

/** How many images are sent to the server at once. */
const CONCURRENCY = 3
const ZIP_NAME = "optimized-images.zip"

const subscribeToNothing = () => () => {}

export function ImageOptimizer() {
  const [items, dispatch] = useReducer(queueReducer, [])
  const [settings, setSettings] = useState<OptimizeSettings>(DEFAULT_SETTINGS)
  const [folder, setFolder] = useState<FileSystemDirectoryHandle | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  // Needs `window`, so it's null during server rendering and hydration.
  const canPickFolder = useSyncExternalStore(
    subscribeToNothing,
    supportsFolderPicker,
    () => null
  )

  const running = progress !== null
  const pendingCount = items.filter(isPending).length
  const allDone = items.length > 0 && pendingCount === 0

  function addFiles(files: File[]) {
    const seen = new Set(items.map((item) => fileKey(item.file)))
    const fresh = files.filter((file) => {
      const key = fileKey(file)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (fresh.length > 0) dispatch({ type: "add", items: fresh.map(createQueueItem) })
  }

  function removeItem(id: string) {
    const item = items.find((candidate) => candidate.id === id)
    if (item) URL.revokeObjectURL(item.previewUrl)
    dispatch({ type: "remove", id })
  }

  function clearAll() {
    for (const item of items) URL.revokeObjectURL(item.previewUrl)
    dispatch({ type: "clear" })
  }

  async function chooseFolder() {
    try {
      const dir = await pickFolder()
      if (dir) setFolder(dir)
    } catch {
      toast.error("Couldn't open that folder", { description: "Try a different one." })
    }
  }

  /** Where this run saves to. Asks for a folder if none is set; null if cancelled. */
  async function openSaveTarget() {
    if (!canPickFolder) {
      return { target: createZipTarget(ZIP_NAME), destination: ZIP_NAME }
    }

    // Still inside the click that started the run, so the picker is allowed to open.
    const dir = folder ?? (await pickFolder())
    if (!dir) return null
    setFolder(dir)

    if (!(await ensureWritePermission(dir))) {
      toast.error(`No permission to save in “${dir.name}”`)
      return null
    }
    return { target: createFolderTarget(dir), destination: dir.name }
  }

  async function optimize() {
    // Once everything is done, the button re-runs the whole list (e.g. after tweaking settings).
    const batch = allDone ? items : items.filter(isPending)
    if (batch.length === 0) return

    const output = await openSaveTarget().catch(() => {
      toast.error("Couldn't open that folder", { description: "Try a different one." })
      return null
    })
    if (!output) return
    const { target, destination } = output

    const runSettings = settings
    if (allDone) dispatch({ type: "requeue-all" })
    setProgress({ done: 0, total: batch.length })

    let saved = 0
    let failed = 0
    let bytesBefore = 0
    let bytesAfter = 0

    await runPool(batch, CONCURRENCY, async (item) => {
      dispatch({ type: "processing", id: item.id })
      try {
        const image = await optimizeOnServer(item.file, runSettings)
        const name = await target.save(
          outputFileName(item.file.name, runSettings.prefix, runSettings.format),
          image.blob
        )
        dispatch({
          type: "done",
          id: item.id,
          result: { name, size: image.blob.size, width: image.width, height: image.height },
        })
        saved++
        bytesBefore += item.file.size
        bytesAfter += image.blob.size
      } catch (error) {
        dispatch({
          type: "failed",
          id: item.id,
          error: error instanceof Error ? error.message : "Something went wrong",
        })
        failed++
      }
      setProgress((current) => current && { ...current, done: current.done + 1 })
    })

    try {
      await target.finish()
    } catch {
      toast.error("Couldn't create the zip file")
    }
    setProgress(null)

    if (saved > 0) {
      const difference = bytesBefore - bytesAfter
      toast.success(`${saved} ${saved === 1 ? "image" : "images"} optimized`, {
        description:
          difference >= 0
            ? `Saved ${formatBytes(difference)} (${Math.round((difference / bytesBefore) * 100)}%) → ${destination}`
            : `${formatBytes(-difference)} larger than the originals → ${destination}`,
      })
    }
    if (failed > 0) {
      toast.error(`${failed} ${failed === 1 ? "image" : "images"} couldn't be optimized`, {
        description: "See the list for details.",
      })
    }
  }

  const runLabel = progress
    ? `Optimizing ${progress.done} of ${progress.total}…`
    : allDone
      ? "Run again"
      : items.length === 0
        ? "Optimize images"
        : `Optimize ${pendingCount} ${pendingCount === 1 ? "image" : "images"}`

  return (
    // Empty: the dropzone stretches to the settings card's height. With files:
    // align to the top so the settings card can stick while the list scrolls.
    <div
      className={cn(
        "grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]",
        items.length > 0 && "items-start"
      )}
    >
      <div className="grid min-w-0 gap-4">
        <Dropzone compact={items.length > 0} onFiles={addFiles} />
        {items.length > 0 && (
          <FileList
            items={items}
            settings={settings}
            locked={running}
            onRemove={removeItem}
            onClear={clearAll}
            onDimensions={(id, width, height) =>
              dispatch({ type: "dimensions", id, width, height })
            }
          />
        )}
      </div>

      <SettingsPanel
        className="lg:sticky lg:top-6"
        settings={settings}
        onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))}
        disabled={running}
        canPickFolder={canPickFolder}
        folderName={folder?.name ?? null}
        onChooseFolder={chooseFolder}
        sampleName={items[0]?.file.name ?? "photo.jpg"}
      >
        <Button
          size="lg"
          className="h-10 w-full"
          onClick={optimize}
          disabled={items.length === 0 || running}
        >
          {running ? (
            <Loader2Icon className="animate-spin" />
          ) : allDone ? (
            <RotateCcwIcon />
          ) : (
            <SparklesIcon />
          )}
          {runLabel}
        </Button>
        {progress && (
          <Progress
            value={(progress.done / progress.total) * 100}
            aria-label="Optimization progress"
          />
        )}
        {!progress && canPickFolder === false && items.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Results download as {ZIP_NAME}
          </p>
        )}
      </SettingsPanel>
    </div>
  )
}
