import { supabase, WEDDING_ASSETS_BUCKET } from '../lib/supabase'
import { getAdminPreference, saveAdminPreference } from '../services/preferencesService'
import { getDisplayPrefs } from '../services/displayPrefsService'
import { resolveTheme } from '../theme/themes'
import type { WeddingSettings } from '../types/wedding'
import { formatWeddingDate } from './formatting'
import { logError } from './errors'

/*
 * The Messenger / Facebook link-preview image: an invitation card drawn on the
 * website's hero photo, in the site's fonts and colours (1200 × 630). It's made
 * in the admin's browser, stored in the wedding-assets bucket, and picked up by
 * the share page and home page on the next site build (pushes + daily rebuild).
 */

const W = 1200
const H = 630
const VERSION = 1

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Draws text with letter spacing (manually, so it works in every browser). */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  const chars = [...text]
  const total = chars.reduce((w, ch) => w + ctx.measureText(ch).width, 0) + spacing * (chars.length - 1)
  let cx = x - total / 2
  const align = ctx.textAlign
  ctx.textAlign = 'left'
  for (const ch of chars) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + spacing
  }
  ctx.textAlign = align
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, weight: string, start: number, max: number): number {
  let size = start
  for (; size > 24; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`
    if (ctx.measureText(text).width <= max) break
  }
  return size
}

/** Renders the preview image for the current settings. */
export async function renderSharePreview(s: WeddingSettings): Promise<Blob> {
  const t = resolveTheme(s.theme)
  const p = t.palette
  const serif = `"${t.heading.family}", ${t.heading.fallback}`
  const sans = `"${t.body.family}", ${t.body.fallback}`
  await Promise.all([
    document.fonts.load(`300 72px "${t.heading.family}"`),
    document.fonts.load(`italic 26px "${t.heading.family}"`),
    document.fonts.load(`500 18px "${t.body.family}"`),
  ]).catch(() => undefined)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  // Background: the hero photo (cover), softened; or the theme's paper tones.
  const photo = await loadImage(s.heroImageUrl)
  if (photo) {
    const k = Math.max(W / photo.width, H / photo.height)
    const pw = photo.width * k
    const ph = photo.height * k
    ctx.drawImage(photo, (W - pw) / 2, (H - ph) / 2, pw, ph)
    ctx.fillStyle = 'rgba(20, 16, 12, 0.32)'
    ctx.fillRect(0, 0, W, H)
  } else {
    const g = ctx.createRadialGradient(W / 2, H * 0.4, 50, W / 2, H / 2, W * 0.7)
    g.addColorStop(0, p.paper)
    g.addColorStop(1, p.linen)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  // The card.
  const cw = 560
  const ch = 540
  const cx = (W - cw) / 2
  const cy = (H - ch) / 2
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 14
  ctx.fillStyle = p.paper
  ctx.fillRect(cx, cy, cw, ch)
  ctx.restore()
  ctx.strokeStyle = p.champagne
  ctx.lineWidth = 1.5
  ctx.strokeRect(cx + 16, cy + 16, cw - 32, ch - 32)
  ctx.lineWidth = 0.75
  ctx.strokeRect(cx + 22, cy + 22, cw - 44, ch - 44)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const mid = W / 2

  ctx.fillStyle = p.gold
  ctx.font = `500 15px ${sans}`
  spaced(ctx, 'YOU’RE INVITED TO THE WEDDING OF', mid, cy + 98, 3.5)

  ctx.fillStyle = p.ink
  const names = s.coupleNames || 'Our Wedding'
  const size = fitFont(ctx, names, serif, '300', 78, cw - 100)
  ctx.font = `300 ${size}px ${serif}`
  ctx.fillText(names, mid, cy + 200)

  ctx.fillStyle = p.inkSoft
  ctx.font = `italic 26px ${serif}`
  ctx.fillText('request the pleasure of your company', mid, cy + 256)

  // Ornament: line · diamond · line.
  ctx.strokeStyle = p.champagne
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(mid - 90, cy + 300)
  ctx.lineTo(mid - 14, cy + 300)
  ctx.moveTo(mid + 14, cy + 300)
  ctx.lineTo(mid + 90, cy + 300)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(mid, cy + 293)
  ctx.lineTo(mid + 7, cy + 300)
  ctx.lineTo(mid, cy + 307)
  ctx.lineTo(mid - 7, cy + 300)
  ctx.closePath()
  ctx.stroke()

  ctx.fillStyle = p.ink
  ctx.font = `500 21px ${sans}`
  spaced(ctx, formatWeddingDate(s.weddingDate, 'full').toUpperCase(), mid, cy + 362, 4)

  ctx.fillStyle = p.muted
  ctx.font = `400 17px ${sans}`
  ctx.fillText('Tap to open your invitation', mid, cy + 446)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image'))), 'image/jpeg', 0.9))
}

/** What the image depends on — it's only re-made when one of these changes. */
export function sharePreviewSignature(s: WeddingSettings): string {
  return JSON.stringify([VERSION, s.coupleNames, s.weddingDate, s.heroImageUrl, s.theme])
}

interface Saved {
  url?: string
  path?: string
  sig?: string
}

let running: Promise<string | null> | null = null

/**
 * Admin: makes sure the stored preview image matches the current settings,
 * re-making it when needed (`force` always re-makes it). Returns its URL.
 */
export function syncSharePreview(s: WeddingSettings, force = false): Promise<string | null> {
  if (running) return running
  running = (async () => {
    try {
      const sig = sharePreviewSignature(s)
      const saved = (await getAdminPreference<Saved>('share_preview')) ?? {}
      if (!force && saved.sig === sig && saved.url) return saved.url
      const blob = await renderSharePreview(s)
      const path = `share/invite-preview-${Date.now()}.jpg`
      const { error } = await supabase.storage.from(WEDDING_ASSETS_BUCKET).upload(path, blob, { cacheControl: '31536000', upsert: false, contentType: 'image/jpeg' })
      if (error) throw error
      const url = supabase.storage.from(WEDDING_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl
      await saveAdminPreference('share_preview', { url, path, sig })
      if (saved.path && saved.path !== path) void supabase.storage.from(WEDDING_ASSETS_BUCKET).remove([saved.path])
      void getDisplayPrefs(true)
      return url
    } catch (e) {
      logError('syncSharePreview', e)
      return null
    } finally {
      running = null
    }
  })()
  return running
}
