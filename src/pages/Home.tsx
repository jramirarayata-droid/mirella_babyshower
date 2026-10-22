import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import { useOutfits } from '../hooks/useOutfits'
import { useGallery } from '../hooks/useGallery'
import { useProgram } from '../hooks/useProgram'
import { CoupleGallery } from '../components/wedding/CoupleGallery'
import { VideoHighlight } from '../components/wedding/VideoHighlight'
import { MediaSectionView, useMediaSections } from '../components/wedding/MediaSections'
import { GuestPhotosTeaser } from '../components/wedding/GuestPhotosTeaser'
import { Hero } from '../components/wedding/Hero'
import { Introduction } from '../components/wedding/Introduction'
import { VerseHighlight } from '../components/wedding/VerseHighlight'
import { ProgramFlow } from '../components/wedding/ProgramFlow'
import { Venues } from '../components/wedding/Venues'
import { InfoSections } from '../components/wedding/InfoSections'
import { PrivateDetails } from '../components/wedding/PrivateDetails'
import { useDisplayPrefs } from '../hooks/useDisplayPrefs'
import { OutfitGallery } from '../components/wedding/OutfitGallery'
import { MotifSection } from '../components/wedding/MotifSwatches'
import { GiftCard } from '../components/wedding/GiftCard'
import { Reveal } from '../components/wedding/Reveal'
import { RSVPCallout } from '../components/wedding/RSVPCallout'
import { Footer } from '../components/wedding/Footer'
import { GenderRevealSection } from '../components/shower/GenderReveal'
import { ShowerFun } from '../components/shower/ShowerFun'
import { PageLoader } from '../components/ui/Spinner'
import { PublicError } from '../components/wedding/PublicError'
import { isRsvpOpen, orderMedia } from '../services/settingsService'
import { getPublicGift } from '../services/giftService'
import type { PublicGift } from '../types/wedding'
import { formatWeddingDate } from '../utils/formatting'
import { GALLERY_LAYOUTS, type GalleryLayout } from '../types/wedding'
import { isThemePreviewFrame } from '../theme/applyTheme'
import { useSpace } from '../hooks/useSpace'
import { homeOrder } from '../utils/pageOrder'
import { PageBackground } from '../components/wedding/PageBackground'

export default function Home() {
  const { settings, loading, error, refresh } = useWeddingSettings()
  const attire = useOutfits()
  const gallery = useGallery()
  const display = useDisplayPrefs()
  const program = useProgram(Boolean(settings?.programVisible))
  const space = useSpace()
  const [gift, setGift] = useState<PublicGift | null>(null)

  useEffect(() => {
    if (settings) document.title = `${settings.babyName} · Baby Shower · ${formatWeddingDate(settings.weddingDate)}`
  }, [settings])

  useEffect(() => {
    let active = true
    getPublicGift().then((g) => active && setGift(g))
    return () => {
      active = false
    }
  }, [])

  const mediaSections = useMediaSections()
  if (loading && !settings) return <PageLoader />
  if (error || !settings) return <PublicError message={error ?? undefined} onRetry={() => refresh()} />

  // What to Wear may be kept for attending guests (Website Settings → Privacy): then only they get the photos.
  const showOutfits = settings.outfitSectionVisible && attire.allowed && attire.images.length > 0
  // Inside the admin's preview, "&gallery=polaroid" tries a layout without saving it.
  const previewLayout = isThemePreviewFrame() ? (/[?&]gallery=([a-z]+)/.exec(window.location.hash)?.[1] as GalleryLayout | undefined) : undefined
  const galleryLayout = GALLERY_LAYOUTS.some((g) => g.id === previewLayout) ? previewLayout! : settings.galleryLayout

  // Every section, by its key (Admin → Page Order decides the order; hidden ones are null).
  const media = orderMedia(
    [
      {
        key: 'gallery',
        node: settings.galleryVisible ? <CoupleGallery title={settings.galleryTitle} subtitle={settings.gallerySubtitle} layout={galleryLayout} images={gallery} /> : null,
      },
      {
        key: 'video',
        node:
          settings.videoVisible && settings.videoUrl ? (
            <VideoHighlight title={settings.videoTitle} caption={settings.videoCaption} url={settings.videoUrl} posterUrl={settings.videoPosterUrl} />
          ) : null,
      },
      ...mediaSections.map((x) => ({ key: x.s.id, node: <MediaSectionView section={x} /> })),
    ],
    settings.mediaOrder ?? [],
  )
  // Details shared only with confirmed guests (Website Settings → Privacy). While the choice
  // is loading, nothing is shown, so private details never flash up. The short "for confirmed
  // guests" note sits where the first private part would be.
  const hideVenues = display ? display.website.hideVenues : true
  const hideInfo = display ? display.website.hideInfo : true
  const noteAt = !display ? null : hideVenues ? 'venue' : hideInfo ? 'info' : null
  const note = noteAt ? <PrivateDetails venues={hideVenues} info={hideInfo} rsvpOpen={isRsvpOpen(settings)} /> : null
  const nodes: Record<string, ReactNode> = {
    intro: <Introduction settings={settings} />,
    verse: settings.verseVisible ? <VerseHighlight text={settings.verseText} reference={settings.verseReference} /> : null,
    reveal: space.has('reveal') ? <GenderRevealSection /> : null,
    guestPhotos: <GuestPhotosTeaser />,
    venue: (
      <>
        {display && !hideVenues && <Venues settings={settings} />}
        {noteAt === 'venue' && note}
      </>
    ),
    program: display && settings.programVisible ? <ProgramFlow title={settings.programTitle} subtitle={settings.programSubtitle} items={program} /> : null,
    info: (
      <>
        {display && !hideInfo && <InfoSections sections={settings.sections} />}
        {noteAt === 'info' && note}
      </>
    ),
    attire: showOutfits ? (
      <OutfitGallery
        title={settings.outfitTitle}
        subtitle={settings.outfitSubtitle}
        images={attire.images}
        layout={settings.outfitLayout}
        motifTitle={settings.motifTitle}
        motifColors={settings.motifColors}
      />
    ) : (
      <MotifSection title={settings.motifTitle} colors={settings.motifColors} />
    ),
    fun: <ShowerFun />,
    gift: gift ? (
      <section aria-label={gift.title} className="px-5 pt-8 sm:px-8">
        <Reveal>
          <GiftCard gift={gift} />
        </Reveal>
      </section>
    ) : null,
    rsvp: (
      <RSVPCallout
        weddingDate={settings.weddingDate}
        open={isRsvpOpen(settings)}
        deadline={settings.rsvpDeadline}
        closedMessage={settings.rsvpClosedMessage}
        showDeadline={settings.rsvpShowDeadline}
        buttonLabel={settings.rsvpButtonLabel}
      />
    ),
  }
  for (const m of media) nodes[`media:${m.key}`] = m.node
  const order = homeOrder(
    media.map((m) => m.key),
    settings.pageOrder,
  )

  return (
    <>
      <PageBackground heroImageUrl={settings.heroImageUrl}>
      <Hero settings={settings} />
      <main>
        {order.map((k) => (
          <Fragment key={k}>{nodes[k] ?? null}</Fragment>
        ))}
      </main>
      <Footer coupleNames={settings.babyName} hostNames={settings.coupleNames} weddingDate={settings.weddingDate} closingMessage={settings.closingMessage} />
      </PageBackground>
    </>
  )
}
