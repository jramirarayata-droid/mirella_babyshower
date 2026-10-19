import { supabase } from '../lib/supabase'
import { FriendlyError, logError } from '../utils/errors'
import { getAdminPreference, saveAdminPreference } from './preferencesService'
import { getDisplayPrefs } from './displayPrefsService'
import { spaceFolder } from '../lib/space'

/** Look & Feel → Monogram: the couple's own monogram image. */
export interface MonogramSettings {
  /** Use it instead of the automatic initials (M & E). */
  enabled: boolean
  url: string
  path: string
  fileName: string
  /** width ÷ height */
  aspect: number
}

export const DEFAULT_MONOGRAM: MonogramSettings = { enabled: false, url: '', path: '', fileName: '', aspect: 1 }

export async function getMonogramSettings(): Promise<MonogramSettings> {
  const v = ((await getAdminPreference<Record<string, unknown>>('monogram')) ?? {}) as Record<string, unknown>
  return {
    enabled: v.enabled === true,
    url: typeof v.url === 'string' ? v.url : '',
    path: typeof v.path === 'string' ? v.path : '',
    fileName: typeof v.fileName === 'string' ? v.fileName : '',
    aspect: Number(v.aspect) > 0 ? Number(v.aspect) : 1,
  }
}

export async function saveMonogramSettings(m: MonogramSettings): Promise<void> {
  await saveAdminPreference('monogram', m)
  void getDisplayPrefs(true)
}

export const MONOGRAM_MAX_MB = 2

/** Removes anything active from an SVG (scripts, event handlers, links out), keeping only the drawing. */
function cleanSvg(text: string): string {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.documentElement
  if (svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new FriendlyError('That SVG file couldn’t be read.')
  doc.querySelectorAll('script, foreignObject, iframe, object, embed, a').forEach((n) => n.remove())
  for (const el of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      const val = attr.value.trim().toLowerCase()
      if (name.startsWith('on') || ((name === 'href' || name === 'xlink:href') && !val.startsWith('#') && !val.startsWith('data:image/'))) el.removeAttribute(attr.name)
    }
  }
  return new XMLSerializer().serializeToString(svg)
}

/** Width ÷ height of an image file. */
async function aspectOf(blob: Blob): Promise<{ aspect: number; w: number; h: number }> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const w = img.naturalWidth || 1
    const h = img.naturalHeight || 1
    return { aspect: w / h, w, h }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Uploads a PNG or SVG monogram. Returns its address, path, shape and a warning if it's small. */
export async function uploadMonogram(file: File): Promise<{ url: string; path: string; aspect: number; warning: string | null }> {
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
  const isPng = file.type === 'image/png' || /\.png$/i.test(file.name)
  if (!isSvg && !isPng) throw new FriendlyError('Please choose a PNG (with a transparent background) or an SVG file.')
  if (file.size > MONOGRAM_MAX_MB * 1048576) throw new FriendlyError(`That file is over ${MONOGRAM_MAX_MB} MB. Please choose a smaller one.`)
  const body: Blob = isSvg ? new Blob([cleanSvg(await file.text())], { type: 'image/svg+xml' }) : file
  const { aspect, h } = await aspectOf(body).catch(() => {
    throw new FriendlyError('That image couldn’t be opened. Please try another file.')
  })
  const path = `${spaceFolder()}monogram/${crypto.randomUUID()}.${isSvg ? 'svg' : 'png'}`
  const { error } = await supabase.storage.from('wedding-assets').upload(path, body, { contentType: isSvg ? 'image/svg+xml' : 'image/png', cacheControl: '31536000', upsert: false })
  if (error) {
    logError('uploadMonogram', error)
    throw new FriendlyError('The monogram couldn’t be uploaded. Please try again.')
  }
  const warning = !isSvg && h < 1000 ? `This image is ${h} px tall — it may look soft when printed. 1500 px or more (or an SVG) is best.` : null
  return { url: supabase.storage.from('wedding-assets').getPublicUrl(path).data.publicUrl, path, aspect, warning }
}

export async function removeMonogramFile(path: string): Promise<void> {
  if (!path) return
  const { error } = await supabase.storage.from('wedding-assets').remove([path])
  if (error) logError('removeMonogramFile', error)
}

const dataUrls = new Map<string, Promise<string>>()

/** The monogram as a data: address — for printables, which must work offline and in print. */
export function monogramDataUrl(url: string): Promise<string> {
  let p = dataUrls.get(url)
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('fetch'))))
      .then(
        (b) =>
          new Promise<string>((resolve, reject) => {
            const fr = new FileReader()
            fr.onload = () => resolve(String(fr.result))
            fr.onerror = () => reject(fr.error)
            fr.readAsDataURL(b)
          }),
      )
    dataUrls.set(url, p)
    p.catch(() => dataUrls.delete(url))
  }
  return p
}
