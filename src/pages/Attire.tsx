import { useCallback, useEffect, useState } from 'react'
import { ShowerShell, ForAttending } from '../components/shower/ShowerShell'
import { OutfitGallery } from '../components/wedding/OutfitGallery'
import { PublicHeader } from '../components/wedding/PublicHeader'
import { Footer } from '../components/wedding/Footer'
import { PageLoader } from '../components/ui/Spinner'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import { listAttire } from '../services/outfitService'
import { currentShowerGuest, type ShowerGuest } from '../services/showerService'
import type { OutfitImage } from '../types/wedding'
import { toFriendlyMessage } from '../utils/errors'

/**
 * #/attire — What to Wear on its own page. When the hosts keep it for guests
 * who are coming (Website Settings → Privacy), the photos only load for a guest
 * whose invitation said "attending" (checked by the database).
 */
export default function Attire() {
  const { settings } = useWeddingSettings()
  const [guest, setGuest] = useState<ShowerGuest | null>(() => currentShowerGuest())
  const [state, setState] = useState<{ allowed: boolean; images: OutfitImage[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (token?: string | null) => {
    try {
      const r = await listAttire(token)
      setState({ allowed: r.allowed, images: r.images })
      setError(null)
    } catch (e) {
      setError(toFriendlyMessage(e))
    }
  }, [])

  useEffect(() => {
    document.title = 'What to Wear'
    void load(guest?.token)
  }, [load, guest])

  const title = settings?.outfitTitle || 'What to Wear'
  if (!state && !error) return <PageLoader label="Loading" />
  if (error || !state) {
    return (
      <ShowerShell title={title}>
        <p className="text-center text-ink-soft">{error}</p>
      </ShowerShell>
    )
  }
  if (!state.allowed) {
    return (
      <ShowerShell title={title}>
        {guest && (
          <p className="mx-auto mb-6 max-w-md rounded-lg border border-champagne/60 bg-champagne-light/30 px-4 py-3 text-center text-sm text-ink-soft">
            Hi {guest.name.split(' ')[0]}! We don’t have a “yes” from your invitation yet.
          </p>
        )}
        <ForAttending what="What to Wear" onReady={setGuest} />
      </ShowerShell>
    )
  }
  if (state.images.length === 0 || !settings) {
    return (
      <ShowerShell title={title}>
        <p className="text-center text-muted">Outfit ideas are coming soon.</p>
      </ShowerShell>
    )
  }
  return (
    <div className="flex min-h-[100svh] flex-col">
      <PublicHeader />
      <main className="flex-1">
        <OutfitGallery
          title={title}
          subtitle={settings.outfitSubtitle}
          images={state.images}
          layout={settings.outfitLayout}
          motifTitle={settings.motifTitle}
          motifColors={settings.motifColors}
        />
      </main>
      <Footer coupleNames={settings.babyName} hostNames={settings.coupleNames} weddingDate={settings.weddingDate} closingMessage={settings.closingMessage} />
    </div>
  )
}
