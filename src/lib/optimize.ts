// Settings and helpers shared by the browser UI and the /api/optimize route.
// Keep this file free of sharp and DOM APIs so it can be imported from both sides.

export const OUTPUT_FORMATS = ["webp", "jpeg", "png"] as const
export type OutputFormat = (typeof OUTPUT_FORMATS)[number]

export const FORMATS: Record<
  OutputFormat,
  { label: string; ext: string; mime: string; hint: string }
> = {
  webp: {
    label: "WebP",
    ext: "webp",
    mime: "image/webp",
    hint: "Smallest files for the web, keeps transparency",
  },
  jpeg: {
    label: "JPG",
    ext: "jpg",
    mime: "image/jpeg",
    hint: "Opens anywhere; transparency becomes white",
  },
  png: {
    label: "PNG",
    ext: "png",
    mime: "image/png",
    hint: "Crisp graphics and screenshots, keeps transparency",
  },
}

export function isOutputFormat(value: unknown): value is OutputFormat {
  return OUTPUT_FORMATS.includes(value as OutputFormat)
}

export type OptimizeSettings = {
  format: OutputFormat
  /** 0 = lightest touch, 100 = smallest files. */
  strength: number
  resize: boolean
  /** Target for the longest side: width for landscape, height for portrait. */
  longEdge: number
  prefix: string
}

export const DEFAULT_SETTINGS: OptimizeSettings = {
  format: "webp",
  strength: 30,
  resize: false,
  longEdge: 1920,
  prefix: "",
}

export const LONG_EDGE_PRESETS = [1280, 1600, 1920, 2560, 3840] as const
export const MIN_LONG_EDGE = 16
// WebP can't encode anything larger than this on either side.
export const MAX_LONG_EDGE = 16383

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Maps strength 0–100 to encoder quality 92–40. */
export function qualityFor(strength: number) {
  return Math.round(92 - clamp(strength, 0, 100) * 0.52)
}

/** WebP encoder effort 4–6: slower, smaller files as strength rises. */
export function webpEffortFor(strength: number) {
  return Math.round(4 + clamp(strength, 0, 100) / 50)
}

/** PNG stays lossless in the "Light" band and is palette-quantised above it. */
export function pngIsLossless(strength: number) {
  return strength < 25
}

export function strengthBand(strength: number) {
  if (strength >= 75) return "Maximum"
  if (strength >= 50) return "Strong"
  if (strength >= 25) return "Balanced"
  return "Light"
}

/** What the strength slider means for the chosen format, e.g. "Quality 76". */
export function strengthSummary(format: OutputFormat, strength: number) {
  if (format === "png") {
    return pngIsLossless(strength)
      ? "Lossless"
      : `Palette Q${qualityFor(strength)}`
  }
  return `Quality ${qualityFor(strength)}`
}

// Characters that macOS or Windows won't accept in a file name.
const UNSAFE_FILENAME_CHARS = '/\\:*?"<>|'

export function sanitizePrefix(prefix: string) {
  const safe = Array.from(prefix)
    .filter((char) => char >= " " && !UNSAFE_FILENAME_CHARS.includes(char))
    .join("")
  // A leading dot would hide the file on macOS.
  return safe.replace(/^[\s.]+/, "").slice(0, 64)
}

export function outputFileName(
  originalName: string,
  prefix: string,
  format: OutputFormat
) {
  const stem = originalName.replace(/\.[^.]+$/, "") || "image"
  return `${sanitizePrefix(prefix)}${stem}.${FORMATS[format].ext}`
}

/** Inserts `-n` before the extension: photo.webp → photo-1.webp. */
export function withNumberSuffix(name: string, n: number) {
  const dot = name.lastIndexOf(".")
  return dot > 0
    ? `${name.slice(0, dot)}-${n}${name.slice(dot)}`
    : `${name}-${n}`
}

export type Orientation = "landscape" | "portrait" | "square"

export function orientationOf(width: number, height: number): Orientation {
  if (width > height) return "landscape"
  if (height > width) return "portrait"
  return "square"
}

/** Mirrors sharp's `fit: "inside"` + `withoutEnlargement` in a longEdge × longEdge box. */
export function fitLongEdge(width: number, height: number, longEdge: number) {
  const scale = Math.min(1, longEdge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** Input types for the dropzone and file dialog, keyed by MIME type. */
export const ACCEPTED_IMAGE_TYPES: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/avif": [".avif"],
  "image/gif": [".gif"],
  "image/tiff": [".tif", ".tiff"],
}

export const ACCEPTED_LABEL = "JPG · PNG · WebP · AVIF · GIF · TIFF"
export const MAX_FILE_BYTES = 100 * 1000 * 1000

/** Decimal units, matching what macOS Finder shows. */
export function formatBytes(bytes: number) {
  if (bytes < 1000) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1000
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}
