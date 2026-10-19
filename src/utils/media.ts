/**
 * Resizes a photo in the browser before upload so a 5–10 MB phone photo
 * becomes roughly 300–600 KB. Keeps orientation from EXIF data.
 */
export async function compressImage(file: File, maxDimension = 2000, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()

  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
  const blob = (await toBlob('image/webp')) ?? (await toBlob('image/jpeg'))
  if (!blob || blob.size >= file.size) return file
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type: blob.type })
}

export type ParsedVideo =
  | { kind: 'youtube'; id: string; embedUrl: string; thumbnail: string }
  | { kind: 'vimeo'; id: string; embedUrl: string }
  | { kind: 'file'; src: string }
  | { kind: 'none' }

/** Understands YouTube (watch, youtu.be, shorts, embed), Vimeo and direct MP4/WebM links. */
export function parseVideoUrl(raw: string): ParsedVideo {
  const url = raw.trim()
  if (!url) return { kind: 'none' }
  if (url.startsWith('samples/')) return { kind: 'file', src: url }
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return { kind: 'none' }
  }
  const host = u.hostname.replace(/^www\.|^m\./, '')
  let yt: string | null = null
  if (host === 'youtu.be') yt = u.pathname.slice(1).split('/')[0]
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') yt = u.searchParams.get('v')
    else {
      const m = /^\/(?:shorts|embed|live)\/([^/?#]+)/.exec(u.pathname)
      if (m) yt = m[1]
    }
  }
  if (yt && /^[\w-]{6,20}$/.test(yt)) {
    return {
      kind: 'youtube',
      id: yt,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
      thumbnail: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
    }
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = /\/(?:video\/)?(\d{5,})(?:\/([\da-f]+))?/.exec(u.pathname)
    if (m) {
      const h = m[2] ?? u.searchParams.get('h')
      return { kind: 'vimeo', id: m[1], embedUrl: `https://player.vimeo.com/video/${m[1]}?autoplay=1&dnt=1${h ? `&h=${h}` : ''}` }
    }
  }
  if (u.protocol === 'https:' && /\.(mp4|webm|m4v)$/i.test(u.pathname)) return { kind: 'file', src: url }
  return { kind: 'none' }
}
