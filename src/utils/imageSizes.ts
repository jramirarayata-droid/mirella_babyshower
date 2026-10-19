/**
 * Smaller versions of photos, so grids and phones don't download full-size
 * images. Photos uploaded here get a small copy (thumbUrl, ~800 px) when
 * uploaded or optimised; Unsplash links are resized by Unsplash itself.
 */

const isUnsplash = (url: string) => /^https:\/\/images\.unsplash\.com\//.test(url)

/** The same Unsplash photo at `width` px (WebP/AVIF when the browser takes it); other links unchanged. */
export function sizedUrl(url: string, width: number): string {
  if (!isUnsplash(url)) return url
  try {
    const u = new URL(url)
    u.searchParams.set('w', String(width))
    u.searchParams.set('q', width <= 900 ? '70' : '78')
    u.searchParams.set('auto', 'format')
    return u.toString()
  } catch {
    return url
  }
}

export interface Sized {
  imageUrl: string
  thumbUrl?: string | null
}

/** The small version for grids and tiles. */
export function thumbOf(img: Sized, width = 800): string {
  return img.thumbUrl || sizedUrl(img.imageUrl, width)
}

/** srcset so the browser picks the right size for the screen (undefined when there's only one size). */
export function srcSetOf(img: Sized): string | undefined {
  if (isUnsplash(img.imageUrl)) return [480, 800, 1200, 1800].map((w) => `${sizedUrl(img.imageUrl, w)} ${w}w`).join(', ')
  if (img.thumbUrl) return `${img.thumbUrl} 800w, ${img.imageUrl} 1800w`
  return undefined
}

/** <img> props for a photo in a grid: small file first, bigger only where the screen needs it. */
export function gridImg(img: Sized, sizes = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw') {
  const srcSet = srcSetOf(img)
  return { src: thumbOf(img), srcSet, sizes: srcSet ? sizes : undefined }
}
