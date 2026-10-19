import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ImageUp, Trash2 } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import { useWeddingSettings } from '../../hooks/useWeddingSettings'
import { DEFAULT_MONOGRAM, MONOGRAM_MAX_MB, getMonogramSettings, removeMonogramFile, saveMonogramSettings, uploadMonogram, type MonogramSettings } from '../../services/monogramService'
import { monogram } from '../../utils/formatting'
import { toFriendlyMessage } from '../../utils/errors'
import { MonogramImage } from '../wedding/Monogram'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { cn } from '../ui/cn'

/**
 * Look & Feel → Monogram: upload the couple's own monogram. When switched on,
 * it replaces the automatic initials (M & E) on the website and in printables,
 * tinted to the theme's colours.
 */
export function MonogramCard() {
  const toast = useToast()
  const { settings } = useWeddingSettings()
  const [m, setM] = useState<MonogramSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [askRemove, setAskRemove] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getMonogramSettings()
      .then(setM)
      .catch(() => setM(DEFAULT_MONOGRAM))
  }, [])

  const save = async (next: MonogramSettings, message?: string) => {
    setM(next)
    try {
      await saveMonogramSettings(next)
      if (message) toast.success(message)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file || !m) return
    setBusy(true)
    try {
      const up = await uploadMonogram(file)
      const old = m.path
      await save({ ...m, url: up.url, path: up.path, aspect: up.aspect, fileName: file.name, enabled: true }, 'Monogram uploaded and switched on.')
      if (old) void removeMonogramFile(old)
      if (up.warning) toast.show(up.warning)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const remove = async () => {
    if (!m) return
    setAskRemove(false)
    const old = m.path
    await save({ ...DEFAULT_MONOGRAM }, 'Monogram removed — the initials are back.')
    if (old) void removeMonogramFile(old)
  }

  const initials = settings ? monogram(settings.coupleNames) : 'M & E'

  return (
    <section aria-labelledby="monogram-heading" className="rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
      <h2 id="monogram-heading" className="text-2xl text-ink">
        Monogram
      </h2>
      <p className="mt-1 text-sm text-muted">
        Use your own monogram instead of the automatic initials (<span className="font-serif italic">{initials}</span>). It takes on your theme’s colours, on the website and in
        printables.
      </p>

      {!m ? (
        <div className="mt-4 h-40 animate-pulse rounded-lg bg-linen/50" />
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Preview label="On the page" className="bg-ivory text-ink">
              {m.url ? <MonogramImage url={m.url} aspect={m.aspect} height="64px" /> : <span className="font-serif text-3xl italic">{initials}</span>}
            </Preview>
            <Preview label="Accent" className="bg-paper text-gold">
              {m.url ? <MonogramImage url={m.url} aspect={m.aspect} height="64px" /> : <span className="font-serif text-3xl italic">{initials}</span>}
            </Preview>
            <Preview label="Over a photo" className="bg-[#3b3631] text-white">
              {m.url ? <MonogramImage url={m.url} aspect={m.aspect} height="64px" /> : <span className="font-serif text-3xl italic">{initials}</span>}
            </Preview>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input tabIndex={-1} ref={input} type="file" accept="image/png,image/svg+xml,.png,.svg" className="sr-only" id="monogram-file" onChange={(e) => void onFile(e.target.files?.[0])} />
            <Button variant="outline" onClick={() => input.current?.click()} loading={busy} loadingText="Uploading…" icon={<ImageUp aria-hidden="true" className="size-4" />}>
              {m.url ? 'Replace monogram' : 'Upload monogram'}
            </Button>
            {m.url && (
              <Button variant="ghost" onClick={() => setAskRemove(true)} icon={<Trash2 aria-hidden="true" className="size-4" />}>
                Remove
              </Button>
            )}
            {m.fileName && <span className="truncate text-xs text-muted">{m.fileName}</span>}
          </div>

          <label className={cn('mt-4 flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 text-sm', m.enabled && m.url ? 'border-champagne bg-champagne-light/30' : 'border-line')}>
            <span>
              <span className="font-medium text-ink">Use my monogram instead of {initials}</span>
              <span className="block text-xs text-muted">Menu, envelope seal, card backs, raffle wheel, loading screen and the printables. Turn off to go back to the initials.</span>
            </span>
            <input type="checkbox" className="mt-0.5 size-5 accent-ink" checked={m.enabled && Boolean(m.url)} disabled={!m.url} onChange={(e) => void save({ ...m, enabled: e.target.checked }, e.target.checked ? 'Your monogram is on.' : 'Back to the initials.')} />
          </label>

          <details className="mt-4 rounded-lg bg-cream/50 px-4 py-3 text-sm text-ink-soft">
            <summary className="cursor-pointer font-medium text-ink">What file works best</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <b>SVG</b> (best — sharp at any size), or a <b>PNG with a transparent background</b>, at least <b>1500 px tall</b> for crisp printing.
              </li>
              <li>The monogram only — no date, names, paper or background. A small, even margin around it.</li>
              <li>One solid colour works best: it’s re-coloured to your theme (dark on light pages, white over photos).</li>
              <li>Upright, roughly as wide as it is tall (round, oval or square crests all work). Up to {MONOGRAM_MAX_MB} MB.</li>
            </ul>
          </details>
        </>
      )}

      <ConfirmDialog
        open={askRemove}
        title="Remove your monogram?"
        message="The website and printables go back to the initials. The file is deleted — you can upload it again anytime."
        confirmLabel="Remove"
        destructive
        onCancel={() => setAskRemove(false)}
        onConfirm={() => void remove()}
      />
    </section>
  )
}

function Preview({ label, className, children }: { label: string; className: string; children: ReactNode }) {
  return (
    <figure className="text-center">
      <div className={cn('grid h-24 place-items-center rounded-lg border border-line', className)}>{children}</div>
      <figcaption className="mt-1 text-[0.7rem] uppercase tracking-[0.2em] text-muted">{label}</figcaption>
    </figure>
  )
}
