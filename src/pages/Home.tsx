import { Fragment, useEffect, useState } from 'react'
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

export default function Home() {
  const { settings, loading, error, refresh } = useWeddingSettings()
  const outfits = useOutfits()
  const gallery = useGallery()
  const display = useDisplayPrefs()
  const program = useProgram(Boolean(settings?.programVisible))
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

  const showOutfits = settings.outfitSectionVisible && outfits.length > 0
  // Inside the admin's preview, "&gallery=polaroid" tries a layout without saving it.
  const previewLayout = isThemePreviewFrame() ? (/[?&]gallery=([a-z]+)/.exec(window.location.hash)?.[1] as GalleryLayout | undefined) : undefined
  const galleryLayout = GALLERY_LAYOUTS.some((g) => g.id === previewLayout) ? previewLayout! : settings.galleryLayout

  return (
    <>
      <Hero settings={settings} />
      <main>
        <Introduction settings={settings} />
        {settings.verseVisible && <VerseHighlight text={settings.verseText} reference={settings.verseReference} />}
        <GenderRevealSection />
        {/* Photos and videos, in the order set in Admin → Photos & Video. */}
        {orderMedia(
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
        ).map((x) => (
          <Fragment key={x.key}>{x.node}</Fragment>
        ))}
        <GuestPhotosTeaser />
        {(() => {
          // Details shared only with confirmed guests (Website Settings → Privacy).
          // While the choice is loading, nothing is shown, so private details never flash up.
          if (!display) return null
          const { hideVenues, hideInfo } = display.website
          return (
            <>
              {!hideVenues && <Venues settings={settings} />}
              {settings.programVisible && <ProgramFlow title={settings.programTitle} subtitle={settings.programSubtitle} items={program} />}
              {!hideInfo && <InfoSections sections={settings.sections} />}
              {(hideVenues || hideInfo) && <PrivateDetails venues={hideVenues} info={hideInfo} rsvpOpen={isRsvpOpen(settings)} />}
            </>
          )
        })()}
        {showOutfits ? (
          <OutfitGallery
            title={settings.outfitTitle}
            subtitle={settings.outfitSubtitle}
            images={outfits}
            layout={settings.outfitLayout}
            motifTitle={settings.motifTitle}
            motifColors={settings.motifColors}
          />
        ) : (
          <MotifSection title={settings.motifTitle} colors={settings.motifColors} />
        )}
        <ShowerFun />
        {gift && (
          <section aria-label={gift.title} className="px-5 pt-8 sm:px-8">
            <Reveal>
              <GiftCard gift={gift} />
            </Reveal>
          </section>
        )}
        <RSVPCallout
          weddingDate={settings.weddingDate}
          open={isRsvpOpen(settings)}
          deadline={settings.rsvpDeadline}
          closedMessage={settings.rsvpClosedMessage}
          showDeadline={settings.rsvpShowDeadline}
          buttonLabel={settings.rsvpButtonLabel}
        />
      </main>
      <Footer coupleNames={settings.babyName} hostNames={settings.coupleNames} weddingDate={settings.weddingDate} closingMessage={settings.closingMessage} />
    </>
  )
}
