import sharp, { type Sharp } from "sharp"

import {
  FORMATS,
  isOutputFormat,
  MAX_LONG_EDGE,
  MIN_LONG_EDGE,
  pngIsLossless,
  qualityFor,
  webpEffortFor,
  type OutputFormat,
} from "@/lib/optimize"

// What sharp's prebuilt binaries can decode. HEIF only counts when it is
// AV1-compressed (AVIF); HEVC-based HEIC isn't included in the binaries.
const READABLE_FORMATS = new Set(["jpeg", "png", "webp", "gif", "tiff", "heif"])

/**
 * Optimizes one image. Expects multipart form data with `file`, `format`,
 * `strength` (0–100) and an optional `longEdge` in pixels. Responds with the
 * encoded image and its final size in `X-Output-Width` / `X-Output-Height`.
 */
export async function POST(request: Request) {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return errorResponse(400, "Expected a multipart form upload")
  }

  const file = form.get("file")
  if (!(file instanceof File)) return errorResponse(400, "No file was uploaded")

  const format = form.get("format")
  if (!isOutputFormat(format)) return errorResponse(400, "Unknown output format")

  const strength = Number(form.get("strength"))
  if (!Number.isFinite(strength) || strength < 0 || strength > 100) {
    return errorResponse(400, "Strength must be between 0 and 100")
  }

  const longEdgeField = form.get("longEdge")
  const longEdge = longEdgeField === null ? null : Number(longEdgeField)
  if (
    longEdge !== null &&
    !(Number.isInteger(longEdge) && longEdge >= MIN_LONG_EDGE && longEdge <= MAX_LONG_EDGE)
  ) {
    return errorResponse(400, `Long edge must be ${MIN_LONG_EDGE}–${MAX_LONG_EDGE} px`)
  }

  const input = Buffer.from(await file.arrayBuffer())

  try {
    const { format: inputFormat, compression } = await sharp(input).metadata()
    if (
      !READABLE_FORMATS.has(inputFormat) ||
      (inputFormat === "heif" && compression !== "av1")
    ) {
      return errorResponse(415, "This image format isn't supported")
    }
  } catch {
    return errorResponse(415, "This file isn't a valid image")
  }

  // Lenient decoding: minor glitches common in camera files shouldn't fail the
  // whole image. Animated GIF/WebP input keeps its first frame only.
  const image = sharp(input, { failOn: "error" }).autoOrient()
  if (longEdge !== null) {
    // A square box means the long side lands on `longEdge` whatever the orientation.
    image.resize({
      width: longEdge,
      height: longEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
  }
  encode(image, format, strength)

  try {
    const { data, info } = await image.toBuffer({ resolveWithObject: true })
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": FORMATS[format].mime,
        "Cache-Control": "no-store",
        "X-Output-Width": String(info.width),
        "X-Output-Height": String(info.height),
      },
    })
  } catch {
    return errorResponse(422, "Couldn't process this image")
  }
}

// sharp converts to sRGB and strips metadata (EXIF, GPS…) by default.
function encode(image: Sharp, format: OutputFormat, strength: number) {
  const quality = qualityFor(strength)
  switch (format) {
    case "webp":
      image.webp({ quality, effort: webpEffortFor(strength) })
      break
    case "jpeg":
      // JPG has no alpha channel, so fill transparent areas with white, not black.
      image.flatten({ background: "#ffffff" }).jpeg({ quality, mozjpeg: true })
      break
    case "png":
      image.png(
        pngIsLossless(strength)
          ? { compressionLevel: 9, adaptiveFiltering: true }
          : { palette: true, quality, compressionLevel: 9 }
      )
      break
  }
}

function errorResponse(status: number, error: string) {
  return Response.json({ error }, { status })
}
