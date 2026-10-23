import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ImagePlus } from 'lucide-react'
import { getGuestPhotosInfo, listGuestPhotos, type GuestPhoto, type GuestPhotosInfo } from '../../services/guestPhotosService'
import { PhotoMasonryStrip } from '../photos/PhotoMasonryStrip'
import { Ornament } from '../ui/Ornament'
import { Lightbox } from './CoupleGallery'
import { Reveal } from './Reveal'
import { useSectionText } from '../../hooks/useSectionText'

const PAGE = 30

/**
 * Home page: the guests' photos as a masonry strip you swipe left and right
 * (more load as you go), and a way in to add yours when it's open.
 */
export function GuestPhotosTeaser() {
  const t = useSectionText('guestPhotos')
  const [info, setInfo] = useState<GuestPhotosInfo | null>(null)
  const [photos, setPhotos] = useState<GuestPhoto[]>([])
  const [more, setMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const busy = useRef(false)
  const shown = useRef<GuestPhoto[]>([])
  useEffect(() => {
    shown.current = photos
  }, [photos])

  useEffect(() => {
    let alive = true
    getGuestPhotosInfo()
      .then(async (i) => {
        if (!alive || !i.visible) return
        setInfo(i)
        if (!i.count) return
        const list = await listGuestPhotos(null, PAGE)
        if (!alive) return
        setPhotos(list)
        setMore(list.length === PAGE)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  const loadMore = useCallback(async () => {
    const last = shown.current.at(-1)
    if (!last || busy.current) return
    busy.current = true
    setLoadingMore(true)
    try {
      const next = await listGuestPhotos(last.at, PAGE)
      setPhotos((p) => [...p, ...next.filter((x) => !p.some((y) => y.id === x.id))])
      setMore(next.length === PAGE)
    } catch {
      setMore(false)
    } finally {
      busy.current = false
      setLoadingMore(false)
    }
  }, [])

  if (!info) return null

  return (
    <section aria-labelledby="guest-photos-heading" className="py-24">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-8">
        <Reveal className="section-title">
          <p className="eyebrow">{t('eyebrow', 'From our guests')}</p>
          <h2 id="guest-photos-heading" className="mt-4 text-4xl text-ink sm:text-5xl">
            {info.title}
          </h2>
          {info.subtitle && <p className="mx-auto mt-4 max-w-lg text-ink-soft">{info.subtitle}</p>}
          <Ornament className="mt-8" />
        </Reveal>
      </div>
      {photos.length > 0 && (
        <Reveal className="mx-auto mt-10 max-w-6xl">
          <PhotoMasonryStrip photos={photos} style={info.style} more={more} loadingMore={loadingMore} onLoadMore={() => void loadMore()} onOpen={setOpen} />
        </Reveal>
      )}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4 px-4">
        {info.open && (
          <Link
            to="/photos"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-8 text-sm font-medium uppercase tracking-[0.2em] text-ivory shadow-soft transition hover:bg-ink-soft"
          >
            <ImagePlus aria-hidden="true" className="size-4" strokeWidth={1.6} /> {t('addButton', 'Add your photos')}
          </Link>
        )}
        {info.count > 0 && (
          <Link to="/photos" className="text-sm text-gold underline-offset-4 hover:underline">
            {t('seeAll', 'See all photos')} ({info.count})
          </Link>
        )}
      </div>
      <Lightbox images={photos.map((p, i) => ({ id: p.id, imageUrl: p.url, caption: p.by ? `by ${p.by}` : '', sortOrder: i, isVisible: true }))} index={open} onChange={setOpen} />
    </section>
  )
}
