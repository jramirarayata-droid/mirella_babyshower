import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { ExternalLink, Lightbulb } from 'lucide-react'
import { currentShowerGuest, getGiftIdeas, IDEA_DESIGNS, type GiftIdea, type GiftIdeasView, type IdeaDesign } from '../../services/showerService'
import type { GalleryImage, GalleryLayout } from '../../types/wedding'
import { CoupleGallery, Lightbox } from '../wedding/CoupleGallery'

// The gift-ideas designs are downloaded only when one is chosen.
const IdeaLayoutView = lazy(() => import('./IdeaLayouts'))
import { Ornament } from '../ui/Ornament'
import { Reveal } from '../wedding/Reveal'
import { useSectionText } from '../../hooks/useSectionText'

/*
 * Gift ideas: photos of things the parents love (a title and a caption each),
 * just for inspiration — guests don't claim them. Their own section on the
 * home page and their own page (#/ideas), with their own Show / Hide switch,
 * gallery design and "Who can see" setting (Admin → Gift Wishlist).
 */

let cached: { token: string | null; p: Promise<GiftIdeasView> } | null = null

/** Loaded once per guest pass (the home page, the menu and the page share it). */
export function loadGiftIdeas(): Promise<GiftIdeasView> {
  const token = currentShowerGuest()?.token ?? null
  if (!cached || cached.token !== token) cached = { token, p: getGiftIdeas(token) }
  return cached.p
}

export function useGiftIdeas(): GiftIdeasView | null {
  const [view, setView] = useState<GiftIdeasView | null>(null)
  useEffect(() => {
    let alive = true
    void loadGiftIdeas().then((v) => alive && setView(v))
    return () => {
      alive = false
    }
  }, [])
  return view
}

/** True when this visitor can see at least one idea. */
export const hasIdeas = (v: GiftIdeasView | null | undefined) => Boolean(v?.visible && !v.private && v.items.length > 0)

/** The ideas in the chosen design. Gallery designs show "Title — caption" with each photo. */
export function GiftIdeasGallery({ view, headingId = 'ideas-heading', page = false }: { view: GiftIdeasView; headingId?: string; page?: boolean }) {
  const images: GalleryImage[] = view.items.map((i, n) => ({
    id: i.id,
    imageUrl: i.image,
    caption: [i.title, i.note].filter(Boolean).join(' — '),
    sortOrder: n,
    isVisible: true,
  }))
  if (IDEA_DESIGNS.includes(view.layout as IdeaDesign)) return <IdeaDesignSection view={view} images={images} headingId={headingId} page={page} />
  if (view.layout !== 'cards') {
    return <CoupleGallery title={view.title} subtitle={view.intro || DEFAULT_INTRO} layout={view.layout as GalleryLayout} images={images} headingId={headingId} eyebrow="Ideas & inspiration" textKey="ideas" bare={page} />
  }
  return (
    <IdeasFrame view={view} headingId={headingId} page={page}>
        <ul className={`${page ? '' : 'mt-12 '}grid gap-5 sm:grid-cols-2 lg:grid-cols-3`} aria-label={view.title}>
          {view.items.map((item, i) => (
            <li key={item.id}>
              <Reveal delay={(i % 3) * 0.06} className="h-full">
                <IdeaCard item={item} />
              </Reveal>
            </li>
          ))}
        </ul>
    </IdeasFrame>
  )
}

/** The section around the ideas: its heading on the home page; just the photos on #/ideas. */
function IdeasFrame({ view, headingId, page, children }: { view: GiftIdeasView; headingId: string; page: boolean; children: ReactNode }) {
  const t = useSectionText('ideas')
  return (
    <section aria-labelledby={page ? undefined : headingId} aria-label={page ? view.title : undefined} className={page ? '' : 'px-5 py-24 sm:px-8 sm:py-28'}>
      <div className="mx-auto max-w-5xl">
        {!page && (
          <Reveal className="section-title text-center">
            <p className="eyebrow">{t('eyebrow', 'Ideas & inspiration')}</p>
            <h2 id={headingId} className="mt-4 text-4xl text-ink sm:text-5xl">
              {view.title}
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-ink-soft">{view.intro || DEFAULT_INTRO}</p>
            <Ornament className="mt-8" />
          </Reveal>
        )}
        {children}
      </div>
    </section>
  )
}

/** Wish board, gift tags, nursery shelf or ribbon showcase, with the full-screen viewer. */
function IdeaDesignSection({ view, images, headingId, page }: { view: GiftIdeasView; images: GalleryImage[]; headingId: string; page: boolean }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <IdeasFrame view={view} headingId={headingId} page={page}>
      <div className={page ? '-mt-12' : ''}>
        <Suspense fallback={<div className="mt-12 h-72 animate-pulse rounded-sm bg-linen/60" />}>
          <IdeaLayoutView design={view.layout as IdeaDesign} title={view.title} items={view.items} onOpen={setOpen} />
        </Suspense>
      </div>
      <Lightbox images={images} index={open} onChange={setOpen} />
    </IdeasFrame>
  )
}

export const DEFAULT_INTRO = 'Just ideas we love — no need to tell us if you choose one.'

/** Home page section: nothing at all unless this visitor may see at least one idea. */
export function GiftIdeasSection() {
  const view = useGiftIdeas()
  if (!view || !hasIdeas(view)) return null
  return <GiftIdeasGallery view={view} />
}

/** An idea: a photo, a title and a caption. Nothing to claim. */
export function IdeaCard({ item }: { item: GiftIdea }) {
  return (
    <div className="fine-frame flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-soft">
      <img src={item.image} alt={item.title || 'Gift idea'} loading="lazy" className="aspect-[4/3] w-full object-cover" />
      <div className="relative z-[2] flex flex-1 flex-col p-5">
        <p className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-[0.24em] text-gold">
          <Lightbulb aria-hidden="true" className="size-3.5" /> Idea
        </p>
        {item.title && <h3 className="mt-2 font-serif text-2xl leading-tight text-ink">{item.title}</h3>}
        {item.note && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.note}</p>}
        {item.link && (
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-gold underline-offset-4 hover:underline">
            See where to find it <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        )}
      </div>
    </div>
  )
}
