import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useWeddingSettings } from '../../hooks/useWeddingSettings'
import { useToast } from '../../hooks/useToast'
import { getAdminPreference } from '../../services/preferencesService'
import { syncSharePreview } from '../../utils/sharePreview'
import { Button } from '../ui/Button'

/** Share & QR: the picture Messenger shows for your invitation links. */
export function SharePreviewCard() {
  const { settings } = useWeddingSettings()
  const toast = useToast()
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Shows the stored image; if it's missing or out of date, waits for it to be (re)made.
  useEffect(() => {
    let alive = true
    getAdminPreference<{ url?: string }>('share_preview')
      .then((v) => alive && v?.url && setUrl(v.url))
      .catch(() => undefined)
    if (settings) syncSharePreview(settings).then((u) => alive && u && setUrl(u))
    return () => {
      alive = false
    }
  }, [settings])

  const remake = async () => {
    if (!settings) return
    setBusy(true)
    const next = await syncSharePreview(settings, true)
    setBusy(false)
    if (next) {
      setUrl(next)
      toast.success('Preview image updated. Messenger shows it after the site’s next update (within a day).')
    } else toast.error('The preview image couldn’t be made. Please try again.')
  }

  return (
    <section className="rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6 lg:col-span-2" aria-labelledby="preview-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h2 id="preview-heading" className="text-2xl text-ink">
            Link preview
          </h2>
          <p className="mt-1 text-sm text-muted">
            The picture Messenger and Facebook show when you send an invitation link. It’s made from your hero photo, names, date and design, and updates by itself when
            those change.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={remake} loading={busy} loadingText="Making…" icon={<RefreshCw aria-hidden="true" className="size-3.5" />}>
          Re-make image
        </Button>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-lg border border-line bg-cream">
          {url ? <img src={url} alt="Link preview image" className="block aspect-[1200/630] w-full object-cover" /> : <div className="flex aspect-[1200/630] items-center justify-center text-sm text-muted">Making the image…</div>}
        </div>
        <div className="text-sm text-ink-soft">
          <p className="font-medium text-ink">If Messenger still shows a plain link</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>Open Facebook’s Sharing Debugger (link below) and sign in.</li>
            <li>Paste one of your invitation links and press <span className="font-medium">Debug</span>.</li>
            <li>
              Press <span className="font-medium">Scrape Again</span>. Messenger then shows the new preview.
            </li>
          </ol>
          <a
            href="https://developers.facebook.com/tools/debug/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-gold underline-offset-4 hover:underline"
          >
            <ExternalLink aria-hidden="true" className="size-3.5" /> Sharing Debugger
          </a>
        </div>
      </div>
    </section>
  )
}
