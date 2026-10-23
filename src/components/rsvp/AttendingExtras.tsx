import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Baby, Gift, Lightbulb, PenLine, Shirt, Sparkles, type LucideIcon } from 'lucide-react'
import { currentShowerGuest, getGiftIdeas, getGuestSections, getRegistry, startShowerGuest, type GuestSections } from '../../services/showerService'
import { listAttire } from '../../services/outfitService'

interface GuestLink {
  to: string
  title: string
  text: string
  icon: LucideIcon
}

const same = (a: string, b: string) => a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * The guest's own pass: the one given, the one on this phone for this name,
 * or a new one for the name on the invitation. Null if none can be had.
 */
async function passFor(token: string | null | undefined, name: string | undefined): Promise<string | null> {
  if (token) return token
  const saved = currentShowerGuest()
  if (saved && (!name || same(saved.name, name))) return saved.token
  if (!name) return null
  const r = await startShowerGuest(name).catch(() => null)
  return r && r.ok ? r.guest.token : null
}

/**
 * "Just for you" links to the sections each shower chose to share beyond the
 * website (Admin → each section → Who sees it): "Website + invitation",
 * "Invited guests only", and — once the guest said yes — "Attending guests
 * only". Used on the invitation page and on the RSVP confirmation. Shows
 * nothing until it knows.
 */
export function GuestSectionLinks({ token, name, attending, className = '' }: { token?: string | null; name?: string; attending: boolean; className?: string }) {
  const [links, setLinks] = useState<GuestLink[] | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      // Nothing shared beyond the website: no need for a pass at all.
      const first = await getGuestSections(token ?? currentShowerGuest()?.token ?? null)
      const keys = ['registry', 'attire', 'reveal', 'predictions', 'names'] as const
      if (!first || !keys.some((k) => first[k].on && first[k].who !== 'website')) {
        if (alive) setLinks([])
        return
      }
      const pass = await passFor(token, name)
      const s: GuestSections | null = await getGuestSections(pass)
      if (!s || !alive) return
      const wanted = (k: keyof Omit<GuestSections, 'registryTab'>) => {
        const x = s[k]
        return x.on && x.open && x.who !== 'website' && (x.who !== 'attending' || attending)
      }
      const next: GuestLink[] = []
      if (wanted('registry')) {
        if (s.registryTab === 'ideas') {
          const i = await getGiftIdeas(pass)
          if (i.visible && !i.private && i.items.length > 0) next.push({ to: '/ideas', title: i.title || 'Gift Ideas', text: 'Photos of things we love — just for inspiration.', icon: Lightbulb })
        } else {
          const r = await getRegistry(pass).catch(() => null)
          if (r?.visible && !r.private && r.items.length > 0) next.push({ to: '/registry', title: r.title || 'Gift Wishlist', text: 'What our little one still needs — mark what you’ll bring.', icon: Gift })
        }
      }
      if (wanted('attire')) {
        const a = await listAttire(pass).catch(() => null)
        if (a?.allowed && a.images.length > 0) next.push({ to: '/attire', title: 'What to Wear', text: 'Outfit ideas and our colours for the day.', icon: Shirt })
      }
      if (wanted('reveal')) next.push({ to: '/', title: 'Gender Reveal', text: 'Boy or girl? Watch the countdown on our website.', icon: Sparkles })
      if (wanted('predictions')) next.push({ to: '/predict', title: 'Baby Predictions', text: 'Guess the birthday, the weight — and boy or girl.', icon: Baby })
      if (wanted('names')) next.push({ to: '/names', title: 'Name Ideas', text: 'Suggest a name you love for our little one.', icon: PenLine })
      if (alive) setLinks(next)
    })()
    return () => {
      alive = false
    }
  }, [token, name, attending])

  if (!links || links.length === 0) return null
  return (
    <nav aria-label="For our guests" className={`mx-auto w-full max-w-xl ${className}`}>
      <p className="eyebrow text-center">Just for you</p>
      <ul className={`mt-4 grid gap-3 ${links.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {links.map((l) => (
          <li key={l.to + l.title}>
            <Link to={l.to} className="flex h-full items-start gap-3 rounded-2xl border border-line bg-paper p-4 text-left shadow-soft transition hover:border-champagne">
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

/** On the RSVP confirmation (and for guests who already said yes). */
export function AttendingExtras({ token, className = '' }: { token: string | null; className?: string }) {
  if (!token) return null
  return <GuestSectionLinks token={token} attending className={className} />
}
