"use client"

import { ImagePlusIcon, UploadIcon } from "lucide-react"
import { useDropzone, type FileRejection } from "react-dropzone"
import { toast } from "sonner"

import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_LABEL,
  formatBytes,
  MAX_FILE_BYTES,
} from "@/lib/optimize"
import { sniffImageType } from "@/lib/sniff-image"
import { cn } from "@/lib/utils"

type Skipped = { name: string; reason: string }

const HEIC_REASON = "HEIC isn't supported, export it as JPG first"

type DropzoneProps = {
  /** Shrinks to a slim bar once the list has files. */
  compact: boolean
  onFiles: (files: File[]) => void
}

export function Dropzone({ compact, onFiles }: DropzoneProps) {
  async function handleDrop(accepted: File[], rejections: FileRejection[]) {
    const skipped: Skipped[] = rejections.map(({ file, errors }) => ({
      name: file.name,
      reason: rejectionReason(file, errors[0]?.code),
    }))

    // The extension check above is easy to fool, so also check the file's bytes.
    const kinds = await Promise.all(
      accepted.map((file) => sniffImageType(file).catch(() => null))
    )
    const images: File[] = []
    accepted.forEach((file, i) => {
      const kind = kinds[i]
      if (kind === "heic") skipped.push({ name: file.name, reason: HEIC_REASON })
      else if (kind === null) skipped.push({ name: file.name, reason: "not a real image file" })
      else images.push(file)
    })

    if (images.length > 0) onFiles(images)
    if (skipped.length > 0) reportSkipped(skipped)
  }

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop: handleDrop,
    accept: ACCEPTED_IMAGE_TYPES,
    maxSize: MAX_FILE_BYTES,
    multiple: true,
  })

  const title = isDragReject
    ? "Only images, please"
    : isDragActive
      ? "Drop to add them"
      : compact
        ? "Drop more images"
        : "Drop images here"

  return (
    <div
      {...getRootProps({
        className: cn(
          "group cursor-pointer rounded-2xl border border-dashed border-foreground/15 bg-card/40 outline-none transition-all duration-200 hover:border-foreground/30 hover:bg-card/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          compact
            ? "flex items-center gap-3 px-4 py-3"
            : "flex min-h-80 flex-col items-center justify-center gap-5 px-6 py-14 text-center sm:min-h-[26rem]",
          isDragActive && "border-foreground/50 bg-foreground/5 ring-4 ring-foreground/5",
          isDragReject && "border-destructive/60 bg-destructive/5 ring-destructive/10"
        ),
      })}
    >
      <input {...getInputProps()} />
      {compact ? (
        <>
          <UploadIcon
            className={cn("size-4 text-muted-foreground", isDragReject && "text-destructive")}
          />
          <p className="text-sm">
            <span className="font-medium">{title}</span>{" "}
            <span className="text-muted-foreground">or click to browse</span>
          </p>
          <p className="ml-auto hidden font-mono text-xs text-muted-foreground md:block">
            {ACCEPTED_LABEL}
          </p>
        </>
      ) : (
        <>
          <div
            className={cn(
              "flex size-14 items-center justify-center rounded-2xl bg-muted ring-1 ring-foreground/10 transition-transform duration-200 group-hover:-translate-y-0.5",
              isDragActive && "-translate-y-1 scale-110",
              isDragReject && "text-destructive"
            )}
          >
            <ImagePlusIcon className="size-6" />
          </div>
          <div className="grid gap-1.5">
            <p className="text-lg font-medium tracking-tight">{title}</p>
            <p className="text-sm text-muted-foreground">
              or{" "}
              <span className="text-foreground underline decoration-foreground/30 underline-offset-4">
                browse your files
              </span>
              . Whole folders work too.
            </p>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {ACCEPTED_LABEL} · up to {formatBytes(MAX_FILE_BYTES)} each
          </p>
        </>
      )}
    </div>
  )
}

function rejectionReason(file: File, code: string | undefined) {
  if (code === "file-too-large") return `larger than ${formatBytes(MAX_FILE_BYTES)}`
  if (/\.hei[cf]$/i.test(file.name) || /^image\/hei[cf]/.test(file.type)) {
    return HEIC_REASON
  }
  if (file.type.startsWith("image/")) return "image format not supported"
  return "not an image"
}

function reportSkipped(skipped: Skipped[]) {
  if (skipped.length === 1) {
    const [{ name, reason }] = skipped
    toast.error(`Skipped ${name}`, { description: capitalize(reason) })
    return
  }

  const shown = skipped.slice(0, 4)
  toast.error(`Skipped ${skipped.length} files`, {
    description: (
      <ul className="grid gap-0.5">
        {shown.map(({ name, reason }, i) => (
          <li key={i} className="truncate">
            <span className="font-medium">{name}</span>: {reason}
          </li>
        ))}
        {skipped.length > shown.length && (
          <li>and {skipped.length - shown.length} more</li>
        )}
      </ul>
    ),
  })
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
