import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Baby, CalendarHeart, Camera, Check, Gift, Lock, LogOut, Mail, MessageCircleHeart, Minus, Palette, PartyPopper, Printer, Sparkles,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { toFriendlyMessage } from '../utils/errors'
import { Button } from '../components/ui/Button'
import { FieldError, TextField } from '../components/ui/FormField'
import { Ornament } from '../components/ui/Ornament'
import { ContactLink, CONTACT_PHONES } from '../components/space/Locked'
import { CORE_FEATURES, FEATURE_LABELS, peso, type Feature, type Plan } from '../lib/plans'
import { spaceUrl } from '../lib/space'
import { loadMyAccount, loadPlans, type MyAccount } from '../services/spaceService'
import { cn } from '../components/ui/cn'

/** Extras shown on the plan cards, in this order. */
const EXTRAS: Feature[] = ['looks_all', 'predictions', 'names', 'reveal', 'guest_photos', 'printables', 'raffle', 'big_screen', 'slideshow', 'music', 'seating', 'cohost']

const HIGHLIGHTS = [
  { icon: Palette, title: 'Soft pastel looks', text: 'Clouds, Balloons, Boho Rainbow, Twinkle Little Star, Hello Sunshine — in your colours.' },
  { icon: Mail, title: 'RSVP in a minute', text: 'Guests find their name, reply and add a plus-one. You see every answer as it comes in.' },
  { icon: Gift, title: 'A wishlist that works', text: 'Guests tap “I’ll bring this”, so nothing is doubled.' },
  { icon: Baby, title: 'Guessing games', text: 'Birthday, weight, boy or girl — and name ideas from everyone who loves the baby.' },
  { icon: Sparkles, title: 'The big reveal', text: 'A countdown keeps the secret safe, then balloons and confetti.' },
  { icon: PartyPopper, title: 'Party-day fun', text: 'Diaper raffle, bingo, a live photo slideshow and big-screen views for the TV.' },
  { icon: Printer, title: 'Printables', text: 'Invitations, gift envelopes, name cards and thank-you cards, ready to print.' },
  { icon: Camera, title: 'Guest photos', text: 'Everyone shares their photos from the day in one place.' },
]

const STEPS = [
  { title: 'Message us', text: 'Tell us about your shower, pick a plan and arrange payment with us.' },
  { title: 'Get your login', text: 'We switch on your website and send your username and password.' },
  { title: 'Set it up & share', text: 'Add your details, guests and colours, then share your link with everyone.' },
]

export default function Landing() {
  const { session, signIn, signOut } = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans] = useState<Plan[]>([])
  const [account, setAccount] = useState<MyAccount | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Baby Shower Websites · Sign in'
    void loadPlans().then(setPlans)
  }, [])

  // Signed in: who is it, and where can they go?
  useEffect(() => {
    if (!session) {
      setAccount(null)
      return
    }
    let alive = true
    void loadMyAccount().then((a) => alive && setAccount(a))
    return () => {
      alive = false
    }
  }, [session])

  const goTo = (a: MyAccount | null) => {
    if (!a) return
    if (a.superAdmin) navigate('/owner')
    else if (a.spaces.length === 1) window.location.assign(spaceUrl(a.spaces[0].slug, '/admin'))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Please enter your username and password.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await signIn(username, password, false)
      const a = await loadMyAccount()
      setAccount(a)
      goTo(a)
    } catch (err) {
      setError(toFriendlyMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const loginCard = (
    <div className="rounded-2xl border border-line bg-paper/95 p-6 shadow-card backdrop-blur sm:p-8">
      {session && account ? (
        <SignedIn account={account} onOwner={() => navigate('/owner')} onSignOut={() => void signOut()} />
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5" aria-labelledby="login-heading">
          <div>
            <h2 id="login-heading" className="font-serif text-3xl text-ink">
              Sign in
            </h2>
            <p className="mt-1 text-sm text-muted">Manage your baby shower website.</p>
          </div>
          <TextField label="Username" autoComplete="username" value={username} onChange={setUsername} autoCapitalize="none" spellCheck={false} required autoFocus />
          <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} required />
          <FieldError>{error}</FieldError>
          <Button type="submit" fullWidth loading={submitting} loadingText="Signing in…" icon={<Lock aria-hidden="true" className="size-4" />}>
            Sign in
          </Button>
          <p className="text-center text-xs text-muted">
            No login yet?{' '}
            <a href="#plans" onClick={(e) => (e.preventDefault(), document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' }))} className="text-gold underline-offset-4 hover:underline">
              See the plans
            </a>{' '}
            and message us to get started.
          </p>
        </form>
      )}
    </div>
  )

  return (
    <div className="min-h-[100svh] bg-ivory">
      {/* soft clouds of colour */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 size-[28rem] rounded-full bg-[#f6d9df] opacity-60 blur-3xl" />
        <div className="absolute -right-24 top-40 size-[26rem] rounded-full bg-[#dfe4f6] opacity-60 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 size-[24rem] rounded-full bg-[#e3eedc] opacity-50 blur-3xl" />
      </div>

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full border border-champagne/60 text-champagne">
            <Baby aria-hidden="true" className="size-4" strokeWidth={1.5} />
          </span>
          <span className="font-serif text-xl text-ink">Baby Shower Websites</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <a href="#plans" onClick={(e) => (e.preventDefault(), document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' }))} className="text-ink-soft hover:text-ink">
            Plans
          </a>
          {CONTACT_PHONES.length > 0 && (
            <ContactLink className="hidden min-h-9 items-center rounded-full border border-champagne/60 px-4 text-ink transition hover:bg-champagne-light/40 sm:inline-flex">
              Message us
            </ContactLink>
          )}
        </nav>
      </header>

      <main className="relative">
        {/* hero + sign in */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24 lg:pt-12">
          <div>
            <p className="eyebrow">For the little one on the way</p>
            <h1 className="mt-4 font-serif text-5xl leading-[1.05] text-ink sm:text-6xl">
              A soft little website <br className="hidden sm:block" />
              for your baby shower
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-soft">
              Invitations, RSVPs, a gift wishlist, guessing games and a gender reveal — all in one gentle place your guests open on their phones.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#plans"
                onClick={(e) => (e.preventDefault(), document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' }))}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-5 font-medium text-ivory shadow-soft transition hover:bg-ink-soft"
              >
                See the plans <ArrowRight aria-hidden="true" className="size-4" />
              </a>
              {CONTACT_PHONES.length > 0 && (
                <ContactLink className="inline-flex min-h-11 items-center gap-2 rounded-md border border-champagne/70 px-5 text-ink transition hover:bg-champagne-light/40">
                  <MessageCircleHeart aria-hidden="true" className="size-4" /> Message us
                </ContactLink>
              )}
            </div>
          </div>
          <div className="lg:justify-self-end lg:w-full lg:max-w-md">{loginCard}</div>
        </section>

        {/* what's inside */}
        <section aria-labelledby="inside-heading" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <div className="text-center">
            <p className="eyebrow">What’s inside</p>
            <h2 id="inside-heading" className="mt-3 font-serif text-4xl text-ink sm:text-5xl">
              Everything for the big day
            </h2>
            <Ornament className="mt-6" />
          </div>
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="rounded-xl border border-line bg-paper/90 p-6 shadow-card">
                <h.icon aria-hidden="true" className="size-6 text-champagne" strokeWidth={1.4} />
                <h3 className="mt-4 font-serif text-2xl text-ink">{h.title}</h3>
                <p className="mt-2 text-sm text-ink-soft">{h.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* plans */}
        <section id="plans" aria-labelledby="plans-heading" className="mx-auto max-w-6xl scroll-mt-6 px-5 py-16 sm:px-8">
          <div className="text-center">
            <p className="eyebrow">Plans</p>
            <h2 id="plans-heading" className="mt-3 font-serif text-4xl text-ink sm:text-5xl">
              Pick what feels right
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-ink-soft">One payment per shower — no monthly fees. Your website stays open until 30 days after the shower.</p>
            <Ornament className="mt-6" />
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {plans.map((p) => (
              <PlanCard key={p.id} plan={p} />
            ))}
            {!plans.length && <p className="text-center text-muted lg:col-span-3">Plans are loading…</p>}
          </div>
          <p className="mt-6 text-center text-xs text-muted">Need longer? Extra months are ₱299 each. Plus-ones don’t count toward the guest limit.</p>
        </section>

        {/* how it works */}
        <section aria-labelledby="how-heading" className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
          <div className="text-center">
            <p className="eyebrow">How it works</p>
            <h2 id="how-heading" className="mt-3 font-serif text-4xl text-ink">
              Three gentle steps
            </h2>
          </div>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-line bg-paper/90 p-6 text-center shadow-card">
                <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-champagne-light font-serif text-xl text-gold">{i + 1}</span>
                <h3 className="mt-4 font-serif text-2xl text-ink">{s.title}</h3>
                <p className="mt-2 text-sm text-ink-soft">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 text-center">
            <p className="mb-4 text-sm text-ink-soft">
              Call or text <span className="font-medium tabular-nums text-ink">{CONTACT_PHONES.join(' or ')}</span>
            </p>
            <ContactLink className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-6 font-medium text-ivory shadow-soft transition hover:bg-ink-soft">
              <MessageCircleHeart aria-hidden="true" className="size-4" /> Message us to get started
            </ContactLink>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-line px-5 py-8 text-center text-xs text-muted">
        <CalendarHeart aria-hidden="true" className="mx-auto mb-2 size-4 text-champagne" />
        Made with love for little ones on the way.
      </footer>
    </div>
  )
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <article
      aria-labelledby={`plan-${plan.id}`}
      className={cn(
        'relative flex flex-col rounded-2xl border bg-paper/95 p-7 shadow-card',
        plan.highlight ? 'border-champagne ring-2 ring-champagne/40' : 'border-line',
      )}
    >
      {plan.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ivory">
          Most loved
        </span>
      )}
      <h3 id={`plan-${plan.id}`} className="font-serif text-3xl text-ink">
        {plan.name}
      </h3>
      <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
      <p className="mt-5 font-serif text-5xl text-ink">
        {peso(plan.pricePhp)}
        <span className="ml-1 font-sans text-sm text-muted">one-time</span>
      </p>
      <p className="mt-2 text-sm text-ink-soft">{plan.guestLimit ? `Up to ${plan.guestLimit} invited guests` : 'Unlimited guests'}</p>
      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {CORE_FEATURES.map((f) => (
          <li key={f} className="flex gap-2.5 text-ink-soft">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-sage" /> {f}
          </li>
        ))}
        {EXTRAS.map((f) => {
          const on = plan.features.includes(f)
          return (
            <li key={f} className={cn('flex gap-2.5', on ? 'text-ink-soft' : 'text-muted/70')}>
              {on ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-sage" /> : <Minus aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
              <span className={cn(!on && 'line-through decoration-line')}>
                {f === 'looks_all' && !on ? 'Clouds look (4 colours)' : FEATURE_LABELS[f]}
                <span className="sr-only">{on ? ' — included' : ' — not included'}</span>
              </span>
            </li>
          )
        })}
      </ul>
      <ContactLink
        className={cn(
          'mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 font-medium transition',
          plan.highlight ? 'bg-ink text-ivory shadow-soft hover:bg-ink-soft' : 'border border-champagne/70 text-ink hover:bg-champagne-light/40',
        )}
      >
        Choose {plan.name}
      </ContactLink>
    </article>
  )
}

function SignedIn({ account, onOwner, onSignOut }: { account: MyAccount; onOwner: () => void; onSignOut: () => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-3xl text-ink">Welcome back{account.displayName ? `, ${account.displayName.split(' ')[0]}` : ''}</h2>
        <p className="mt-1 text-sm text-muted">Signed in as {account.username ?? 'you'}.</p>
      </div>
      {account.superAdmin && (
        <Button fullWidth onClick={onOwner} icon={<Sparkles aria-hidden="true" className="size-4" />}>
          Owner page — all showers
        </Button>
      )}
      {account.spaces.length > 0 ? (
        <ul className="space-y-2">
          {account.spaces.map((s) => (
            <li key={s.id}>
              <a
                href={spaceUrl(s.slug, '/admin')}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-ivory px-4 py-3 transition hover:border-champagne"
              >
                <span>
                  <span className="block font-medium text-ink">{s.title}</span>
                  <span className="block text-xs text-muted">
                    {s.plan?.name ?? ''} · {s.open ? 'open' : 'not active — message us'}
                  </span>
                </span>
                <ArrowRight aria-hidden="true" className="size-4 text-champagne" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        !account.superAdmin && (
          <p className="rounded-lg bg-cream px-4 py-3 text-sm text-ink-soft">
            Your login isn’t linked to a baby shower yet. Please message us and we’ll set it up.
          </p>
        )
      )}
      <Button variant="ghost" fullWidth onClick={onSignOut} icon={<LogOut aria-hidden="true" className="size-4" />}>
        Sign out
      </Button>
    </div>
  )
}
