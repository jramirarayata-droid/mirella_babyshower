import { useEffect, useState } from 'react'
import { ShowerShell, NotYet, ForAttending } from '../components/shower/ShowerShell'
import { PageLoader } from '../components/ui/Spinner'
import { DEFAULT_INTRO, GiftIdeasGallery } from '../components/shower/GiftIdeas'
import { currentShowerGuest, getGiftIdeas, type GiftIdeasView, type ShowerGuest } from '../services/showerService'

/** #/ideas — the gift ideas on their own page (linked from the menu and the RSVP confirmation). */
export default function Ideas() {
  const [guest, setGuest] = useState<ShowerGuest | null>(() => currentShowerGuest())
  const [view, setView] = useState<GiftIdeasView | null>(null)

  useEffect(() => {
    let alive = true
    void getGiftIdeas(guest?.token).then((v) => {
      if (!alive) return
      setView(v)
      document.title = v.title || 'Gift Ideas'
    })
    return () => {
      alive = false
    }
  }, [guest])

  if (!view) return <PageLoader />
  const shown = view.visible && !view.private && view.items.length > 0
  return (
    <ShowerShell title={view.title || 'Gift Ideas'} intro={shown ? view.intro || DEFAULT_INTRO : undefined}>
      {!view.visible ? (
        <NotYet what="Our gift ideas" />
      ) : view.private ? (
        <ForAttending what="Our gift ideas" onReady={setGuest} />
      ) : view.items.length === 0 ? (
        <p className="text-center text-muted">The ideas are being put together — please check back soon.</p>
      ) : (
        <GiftIdeasGallery view={view} page headingId="ideas-page-heading" />
      )}
    </ShowerShell>
  )
}
