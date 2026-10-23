import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gift, Lightbulb, Shirt, type LucideIcon } from 'lucide-react'
import { getGiftIdeas, getRegistry, getRsvpExtras } from '../../services/showerService'
import { listAttire } from '../../services/outfitService'

/**
 * On the RSVP confirmation (and for guests who already said yes): the gift
 * wishlist and What to Wear — including when the hosts keep them for attending
 * guests only. Shows nothing until the guest's pass is ready.
 */
export function AttendingExtras({ token, className = '' }: { token: string | null; className?: string }) {
  const [links, setLinks] = useState<{ to: string; title: string; text: string; icon: LucideIcon }[] | null>(null)

  useEffect(() => {
    if (!token) return
    let alive = true
    Promise.all([getRegistry(token).catch(() => null), listAttire(token).catch(() => null), getGiftIdeas(token), getRsvpExtras()]).then(([r, a, i, on]) => {
      if (!alive) return
      const next: { to: string; title: string; text: string; icon: LucideIcon }[] = []
      // guestVisible: what a guest sees, even when an admin is signed in on this browser (e.g. testing).
      if (on.wishlist && r?.guestVisible && !r.private && r.items.length > 0) next.push({ to: '/registry', title: r.title || 'Gift Wishlist', text: 'What our little one still needs — mark what you’ll bring.', icon: Gift })
      if (on.ideas && i.visible && !i.private && i.items.length > 0) next.push({ to: '/ideas', title: i.title || 'Gift Ideas', text: 'Photos of things we love — just for inspiration.', icon: Lightbulb })
      if (on.attire && a?.allowed && a.images.length > 0) next.push({ to: '/attire', title: 'What to Wear', text: 'Outfit ideas and our colours for the day.', icon: Shirt })
      setLinks(next)
    })
    return () => {
      alive = false
    }
  }, [token])

  if (!links || links.length === 0) return null
  return (
    <nav aria-label="For our guests" className={`mx-auto w-full max-w-xl ${className}`}>
      <p className="eyebrow text-center">Just for you</p>
      <ul className={`mt-4 grid gap-3 ${links.length === 2 ? 'sm:grid-cols-2' : links.length > 2 ? 'sm:grid-cols-3' : ''}`}>
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="flex h-full items-start gap-3 rounded-2xl border border-line bg-paper p-4 text-left shadow-soft transition hover:border-champagne"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-champagne-light/50 text-gold">
                <l.icon aria-hidden="true" className="size-5" strokeWidth={1.5} />
              </span>
              <span>
                <span className="block font-serif text-xl text-ink">{l.title}</span>
                <span className="mt-0.5 block text-sm text-ink-soft">{l.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
