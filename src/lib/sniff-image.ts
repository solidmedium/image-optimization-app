export type SniffedImage = "jpeg" | "png" | "gif" | "webp" | "avif" | "tiff"

const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "mif1",
  "msf1",
])

/**
 * Identifies an image by its leading bytes instead of trusting the file name
 * or reported MIME type. Returns "heic" for HEIC/HEIF photos (which we can't
 * decode) and null for anything that isn't a supported image.
 */
export async function sniffImageType(
  file: Blob
): Promise<SniffedImage | "heic" | null> {
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer())
  if (bytes.length < 12) return null

  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, end))

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg"
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return "png"
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return "gif"
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp"
  if (ascii(0, 4) === "II*\0" || ascii(0, 4) === "MM\0*") return "tiff"

  if (ascii(4, 8) === "ftyp") {
    // ISO-BMFF container: the major brand (bytes 8–12) and compatible brands
    // (from byte 16 to the end of the ftyp box) tell AVIF apart from HEIC.
    const boxSize = new DataView(bytes.buffer).getUint32(0)
    const boxEnd = Math.min(boxSize, bytes.length)
    const brands = [ascii(8, 12)]
    for (let i = 16; i + 4 <= boxEnd; i += 4) brands.push(ascii(i, i + 4))

    if (brands.includes("avif") || brands.includes("avis")) return "avif"
    if (brands.some((brand) => HEIC_BRANDS.has(brand))) return "heic"
  }

  return null
}
