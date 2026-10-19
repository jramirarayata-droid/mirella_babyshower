/*
 * Prepares a guest's photo on their phone before upload: a 2048 px JPEG
 * (about 300–600 KB instead of 3–8 MB) and a 480 px thumbnail for the gallery
 * grid. Drawing onto a canvas also drops the photo's hidden data, such as
 * where it was taken.
 */

export interface PreparedPhoto {
  full: Blob
  thumb: Blob
  /** A local preview while uploading. */
  previewUrl: string
  width: number
  height: number
}

const FULL = 2048
const THUMB = 480

function toJpeg(bitmap: ImageBitmap, max: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('canvas'))
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality))
}

/** Throws "UNSUPPORTED" for files the browser can't open (e.g. some HEIC photos on a computer). */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif|gif)$/i.test(file.name)) throw new Error('UNSUPPORTED')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('UNSUPPORTED')
  }
  try {
    const [full, thumb] = [await toJpeg(bitmap, FULL, 0.82), await toJpeg(bitmap, THUMB, 0.72)]
    return { full, thumb, previewUrl: URL.createObjectURL(thumb), width: bitmap.width, height: bitmap.height }
  } finally {
    bitmap.close?.()
  }
}
