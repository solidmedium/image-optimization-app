"use client"

import Image from "next/image"
import { useState } from "react"
import {
  CheckIcon,
  CircleAlertIcon,
  ImageIcon,
  Loader2Icon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  fitLongEdge,
  formatBytes,
  orientationOf,
  outputFileName,
  type OptimizeSettings,
} from "@/lib/optimize"
import type { QueueItem } from "@/lib/queue"
import { cn } from "@/lib/utils"

type FileListProps = {
  items: QueueItem[]
  settings: OptimizeSettings
  /** True while a run is in progress: no removing or clearing. */
  locked: boolean
  onRemove: (id: string) => void
  onClear: () => void
  onDimensions: (id: string, width: number, height: number) => void
}

export function FileList({
  items,
  settings,
  locked,
  onRemove,
  onClear,
  onDimensions,
}: FileListProps) {
  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0)
  const done = items.filter((item) => item.status === "done")
  const doneBefore = done.reduce((sum, item) => sum + item.file.size, 0)
  const doneAfter = done.reduce((sum, item) => sum + (item.result?.size ?? 0), 0)

  return (
    <section className="grid gap-3">
      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-sm">
          <span className="font-medium">
            {items.length} {items.length === 1 ? "image" : "images"}
          </span>
          <span className="text-muted-foreground"> · {formatBytes(totalBytes)}</span>
        </p>
        {done.length > 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <SavingsBadge before={doneBefore} after={doneAfter} />
            {doneAfter <= doneBefore
              ? `${formatBytes(doneBefore - doneAfter)} saved`
              : `${formatBytes(doneAfter - doneBefore)} larger`}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-muted-foreground"
          onClick={onClear}
          disabled={locked}
        >
          <Trash2Icon />
          Clear
        </Button>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {items.map((item) => (
          <FileRow
            key={item.id}
            item={item}
            settings={settings}
            locked={locked}
            onRemove={onRemove}
            onDimensions={onDimensions}
          />
        ))}
      </ul>
    </section>
  )
}

function FileRow({
  item,
  settings,
  locked,
  onRemove,
  onDimensions,
}: {
  item: QueueItem
  settings: OptimizeSettings
  locked: boolean
  onRemove: (id: string) => void
  onDimensions: (id: string, width: number, height: number) => void
}) {
  const { file, status, result, dimensions } = item

  return (
    <li className="group/row flex items-center gap-3 px-3 py-2.5 duration-300 animate-in fade-in-0 slide-in-from-bottom-1">
      <Thumbnail item={item} onDimensions={onDimensions} />

      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <p className="truncate text-sm font-medium">{file.name}</p>
          {dimensions && (
            <span className="shrink-0 text-[11px] text-muted-foreground capitalize">
              {orientationOf(dimensions.width, dimensions.height)}
            </span>
          )}
        </div>
        <p
          className={cn(
            "truncate font-mono text-xs text-muted-foreground",
            status === "error" && "font-sans text-destructive"
          )}
        >
          {detailLine(item, settings)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
        {status === "done" && result ? (
          <>
            <span className="hidden text-muted-foreground sm:inline">
              {formatBytes(file.size)} →
            </span>
            <span className="font-medium">{formatBytes(result.size)}</span>
            <SavingsBadge before={file.size} after={result.size} />
          </>
        ) : status === "error" ? (
          <Badge variant="destructive">Failed</Badge>
        ) : (
          <span className="text-muted-foreground">{formatBytes(file.size)}</span>
        )}

        {!locked && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => onRemove(item.id)}
                  className="text-muted-foreground sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-visible:opacity-100"
                />
              }
            >
              <XIcon />
            </TooltipTrigger>
            <TooltipContent>Remove</TooltipContent>
          </Tooltip>
        )}
      </div>
    </li>
  )
}

function detailLine(item: QueueItem, settings: OptimizeSettings) {
  const { file, status, result, dimensions, error } = item
  const size = (box: { width: number; height: number }) => `${box.width}×${box.height}`

  if (status === "processing") return "Optimizing…"
  if (status === "error") return error ?? "Something went wrong"
  if (status === "done" && result) {
    const resized =
      dimensions && (dimensions.width !== result.width || dimensions.height !== result.height)
        ? `${size(dimensions)} → ${size(result)}`
        : size(result)
    return `→ ${result.name} · ${resized}`
  }

  // Queued: preview what this run will produce.
  const name = outputFileName(file.name, settings.prefix, settings.format)
  if (!dimensions) return `→ ${name}`
  const planned = settings.resize
    ? fitLongEdge(dimensions.width, dimensions.height, settings.longEdge)
    : dimensions
  const changes =
    planned.width !== dimensions.width || planned.height !== dimensions.height
  return `→ ${name} · ${size(dimensions)}${changes ? ` → ${size(planned)}` : ""}`
}

function Thumbnail({
  item,
  onDimensions,
}: {
  item: QueueItem
  onDimensions: (id: string, width: number, height: number) => void
}) {
  // TIFFs (and anything else the browser can't display) fall back to an icon.
  const [broken, setBroken] = useState(false)

  return (
    <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
      {broken ? (
        <ImageIcon className="absolute inset-0 m-auto size-4 text-muted-foreground" />
      ) : (
        <Image
          src={item.previewUrl}
          alt=""
          fill
          sizes="44px"
          className="object-cover"
          onLoad={(event) =>
            onDimensions(
              item.id,
              event.currentTarget.naturalWidth,
              event.currentTarget.naturalHeight
            )
          }
          onError={() => setBroken(true)}
        />
      )}

      {item.status === "processing" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
          <Loader2Icon className="size-4 animate-spin" />
        </div>
      )}
      {item.status === "done" && (
        <div className="absolute right-0.5 bottom-0.5 flex size-4 items-center justify-center rounded-full bg-success text-background duration-300 animate-in zoom-in-50">
          <CheckIcon className="size-3" strokeWidth={3} />
        </div>
      )}
      {item.status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/25">
          <CircleAlertIcon className="size-4 text-destructive" />
        </div>
      )}
    </div>
  )
}

function SavingsBadge({ before, after }: { before: number; after: number }) {
  const smaller = after <= before
  const percent = before > 0 ? Math.round((Math.abs(before - after) / before) * 100) : 0
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono tabular-nums",
        smaller
          ? "border-success/25 bg-success/10 text-success"
          : "border-warning/25 bg-warning/10 text-warning"
      )}
    >
      {smaller ? "−" : "+"}
      {percent}%
    </Badge>
  )
}
