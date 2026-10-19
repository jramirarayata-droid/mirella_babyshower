import { useCallback, useEffect, useState } from 'react'
import { Check, ExternalLink, Gift, Minus, Plus } from 'lucide-react'
import { ShowerShell, GuestGate, NotYet, SignedInAs } from '../components/shower/ShowerShell'
import { PageLoader } from '../components/ui/Spinner'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { cn } from '../components/ui/cn'
import { useToast } from '../hooks/useToast'
import { claimRegistryItem, currentShowerGuest, getRegistry, unclaimRegistryItem, type RegistryItem, type RegistryView, type ShowerGuest } from '../services/showerService'
import { forgetKnownGuest } from '../utils/guestIdentity'
import { toFriendlyMessage } from '../utils/errors'

/**
 * #/registry — the gift wishlist. Guests mark "I'll bring this" so nothing is
 * doubled; they see what's still needed and their own picks, never who
 * picked what. The database stops two guests taking the last one.
 */
export default function Registry() {
  const toast = useToast()
  const [guest, setGuest] = useState<ShowerGuest | null>(() => currentShowerGuest())
  const [view, setView] = useState<RegistryView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [asking, setAsking] = useState<string | null>(null)

  const load = useCallback(async (token?: string | null) => {
    try {
      setView(await getRegistry(token))
      setError(null)
    } catch (e) {
      setError(toFriendlyMessage(e))
    }
  }, [])

  useEffect(() => {
    document.title = 'Gift Wishlist'
    void load(guest?.token)
  }, [load, guest])

  // The session ended (e.g. expired): ask again.
  useEffect(() => {
    if (view && guest && !view.me) setGuest(null)
  }, [view, guest])

  const claim = async (item: RegistryItem, qty: number) => {
    if (!guest) {
      setAsking(item.id)
      return
    }
    setBusy(item.id)
    try {
      const r = await claimRegistryItem(guest.token, item.id, qty)
      if (r.ok) toast.success(`Thank you! “${item.title}” is marked for you.`)
      else if (r.reason === 'taken') toast.error(r.left ? `Only ${r.left} still needed — someone just picked one.` : 'Someone just picked the last one. Thank you all the same!')
      else if (r.reason === 'who') setGuest(null)
      else toast.error('The wishlist is closed right now.')
      await load(guest.token)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const unclaim = async (item: RegistryItem) => {
    if (!guest) return
    setBusy(item.id)
    try {
      await unclaimRegistryItem(guest.token, item.id)
      toast.success(`Okay — “${item.title}” is free again.`)
      await load(guest.token)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const title = view?.title ?? 'Gift Wishlist'
  return (
    <ShowerShell title={title} intro={view?.visible ? view.intro : undefined}>
      {!view && !error ? (
        <PageLoader label="Loading the wishlist" />
      ) : error && !view ? (
        <p className="text-center text-ink-soft">{error}</p>
      ) : view && !view.visible ? (
        <NotYet what="The gift wishlist" />
      ) : view ? (
        <>
          {guest ? (
            <SignedInAs
              name={guest.name}
              onSwitch={() => {
                forgetKnownGuest()
                setGuest(null)
              }}
            />
          ) : asking ? (
            <div className="mb-8">
              <GuestGate
                why="So we know who’s bringing what — only the parents-to-be see your name."
                onReady={(g) => {
                  setGuest(g)
                  const item = view.items.find((i) => i.id === asking)
                  setAsking(null)
                  if (item) window.setTimeout(() => void claimAfter(g, item), 50)
                }}
              />
            </div>
          ) : (
            <p className="text-center text-sm text-muted">Tap “I’ll bring this” on anything you’d like to give.</p>
          )}
          {view.items.length === 0 ? (
            <p className="mt-10 text-center text-muted">The wishlist is being put together — please check back soon.</p>
          ) : (
            <ul className="mt-8 grid gap-5 sm:grid-cols-2">
              {view.items.map((item) => (
                <ItemCard key={item.id} item={item} busy={busy === item.id} onClaim={(q) => void claim(item, q)} onUnclaim={() => void unclaim(item)} />
              ))}
            </ul>
          )}
        </>
      ) : null}
    </ShowerShell>
  )

  // After signing in from an item's button, finish what the guest started.
  async function claimAfter(g: ShowerGuest, item: RegistryItem) {
    setBusy(item.id)
    try {
      const r = await claimRegistryItem(g.token, item.id, 1)
      if (r.ok) toast.success(`Thank you! “${item.title}” is marked for you.`)
      else if (r.reason === 'taken') toast.error('Someone just picked the last one. Thank you all the same!')
      await load(g.token)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setBusy(null)
    }
  }
}

function ItemCard({ item, busy, onClaim, onUnclaim }: { item: RegistryItem; busy: boolean; onClaim: (qty: number) => void; onUnclaim: () => void }) {
  const left = Math.max(0, item.quantity - item.claimed)
  const [qty, setQty] = useState(1)
  const full = left === 0
  return (
    <li className={cn('fine-frame flex flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-soft', full && !item.mine && 'opacity-75')}>
      {item.image ? (
        <img src={item.image} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div aria-hidden="true" className="grid aspect-[4/3] w-full place-items-center bg-[linear-gradient(160deg,var(--color-linen),var(--color-cream))]">
          <Gift className="size-12 text-champagne" strokeWidth={1.1} />
        </div>
      )}
      <div className="relative z-[2] flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-2xl leading-tight text-ink">{item.title}</h2>
          {item.price && <span className="shrink-0 text-sm text-muted">{item.price}</span>}
        </div>
        {item.note && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.note}</p>}
        <p className="mt-3 text-sm">
          {full ? (
            <Badge tone="green">All taken care of — thank you!</Badge>
          ) : item.quantity > 1 ? (
            <span className="text-ink-soft">
              <strong className="font-medium text-ink">{left}</strong> of {item.quantity} still needed
            </span>
          ) : (
            <span className="text-ink-soft">Still needed</span>
          )}
        </p>
        {item.link && (
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-gold underline-offset-4 hover:underline">
            See an example <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        )}
        <div className="mt-auto pt-4">
          {item.mine > 0 && (
            <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-sage/10 px-3 py-2 text-sm text-sage">
              <Check aria-hidden="true" className="size-4" /> You’re bringing {item.quantity > 1 ? `${item.mine}` : 'this'}.
              <button type="button" onClick={onUnclaim} disabled={busy} className="ml-auto text-xs text-ink-soft underline-offset-4 hover:underline">
                Undo
              </button>
            </p>
          )}
          {!full && (
            <div className="flex items-center gap-2">
              {left > 1 && (
                <div className="flex items-center rounded-full border border-line" role="group" aria-label="How many">
                  <button type="button" aria-label="One fewer" className="grid size-10 place-items-center text-ink-soft disabled:opacity-40" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)}>
                    <Minus aria-hidden="true" className="size-4" />
                  </button>
                  <span className="w-6 text-center tabular-nums" aria-live="polite">
                    {qty}
                  </span>
                  <button type="button" aria-label="One more" className="grid size-10 place-items-center text-ink-soft disabled:opacity-40" disabled={qty >= left} onClick={() => setQty((q) => q + 1)}>
                    <Plus aria-hidden="true" className="size-4" />
                  </button>
                </div>
              )}
              <Button className="lux-cta flex-1" loading={busy} loadingText="Saving…" onClick={() => onClaim(Math.min(qty, left))} icon={<Gift aria-hidden="true" className="size-4" />}>
                I’ll bring {item.mine > 0 ? 'more' : 'this'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
