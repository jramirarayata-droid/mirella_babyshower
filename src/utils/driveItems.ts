import { adminListGuestPhotos } from '../services/guestPhotosService'
import { listEveryGalleryImage } from '../services/galleryService'
import { listMediaSections } from '../services/mediaSectionsService'
import { cleanFileName, type DriveItem } from '../services/googleDriveService'

/** "2026-12-19 18.42" in Philippine time (Drive names can't hold ":"). */
function stamp(iso: string): string {
  try {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date(iso))
        .map((x) => [x.type, x.value]),
    )
    return `${p.year}-${p.month}-${p.day} ${p.hour}.${p.minute}`
  } catch {
    return iso.slice(0, 16).replace('T', ' ').replace(':', '.')
  }
}

const extOf = (url: string) => (/\.(jpe?g|png|webp|gif|heic|avif)(?:$|[?#])/i.exec(url)?.[1].toLowerCase().replace('jpeg', 'jpg') ?? 'jpg')

/** Every guest photo that's shown on the site, full size, named after who shared it. */
export async function guestPhotoDriveItems(): Promise<DriveItem[]> {
  const photos = await adminListGuestPhotos()
  return photos
    .filter((p) => p.status === 'visible')
    .map((p) => ({
      sourceId: `guest:${p.id}`,
      url: p.url,
      fileName: cleanFileName(`${p.uploaderName || 'Guest'} — ${stamp(p.createdAt)} — ${p.id.slice(0, 6)}.jpg`),
    }))
}

/** The couple's own photos (main gallery and extra photo sections), full size. Sample photos are left out. */
export async function couplePhotoDriveItems(): Promise<DriveItem[]> {
  const [photos, sections] = await Promise.all([listEveryGalleryImage(), listMediaSections().catch(() => [])])
  const title = new Map(sections.map((s) => [s.id, s.title]))
  const count = new Map<string, number>()
  return photos
    .filter((p) => !p.imageUrl.startsWith('samples/') && !p.imageUrl.includes('images.unsplash.com'))
    .map((p) => {
      const group = (p.sectionId && title.get(p.sectionId)?.trim()) || 'Our Photos'
      const n = (count.get(group) ?? 0) + 1
      count.set(group, n)
      return {
        sourceId: `ours:${p.id}`,
        url: p.imageUrl,
        fileName: cleanFileName(`${group} — ${String(n).padStart(3, '0')}${p.caption.trim() ? ` — ${p.caption.trim().slice(0, 60)}` : ''}.${extOf(p.imageUrl)}`),
      }
    })
}
