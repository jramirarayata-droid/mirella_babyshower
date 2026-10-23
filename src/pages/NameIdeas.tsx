import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { ShowerShell, GuestGate, NotYet, SignedInAs, KeptFor } from '../components/shower/ShowerShell'
import { NameCloud } from '../components/shower/NameCloud'
import { PageLoader } from '../components/ui/Spinner'
import { Button } from '../components/ui/Button'
import { TextField } from '../components/ui/FormField'
import { Badge } from '../components/ui/Badge'
import { cn } from '../components/ui/cn'
import { useToast } from '../hooks/useToast'
import {
  addNameIdea,
  currentShowerGuest,
  getNameIdeasInfo,
  listNameIdeas,
  removeNameIdea,
  type NameFor,
  type NameIdea,
  type NameIdeasInfo,
  type ShowerGuest,
} from '../services/showerService'
import { forgetKnownGuest } from '../utils/guestIdentity'
import { toFriendlyMessage } from '../utils/errors'

const FOR: { v: NameFor; l: string }[] = [
  { v: 'girl', l: 'For a girl' },
  { v: 'boy', l: 'For a boy' },
  { v: 'any', l: 'Either' },
]

/** #/names — guests suggest names for the baby; everyone sees the ideas. */
export default function NameIdeas() {
  const toast = useToast()
  const [guest, setGuest] = useState<ShowerGuest | null>(() => currentShowerGuest())
  const [info, setInfo] = useState<NameIdeasInfo | null>(null)
  const [ideas, setIdeas] = useState<NameIdea[]>([])
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [forGender, setFor] = useState<NameFor>('any')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (token?: string | null) => {
    try {
      const [i, list] = await Promise.all([getNameIdeasInfo(token), listNameIdeas(token)])
      setInfo(i)
      setIdeas(list)
      setError(null)
      if (token && !i.me) setGuest(null)
    } catch (e) {
      setError(toFriendlyMessage(e))
    }
  }, [])

  useEffect(() => {
    document.title = 'Name Ideas'
    void load(guest?.token)
  }, [load, guest])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!guest || !name.trim()) return
    setSaving(true)
    try {
      const r = await addNameIdea(guest.token, name, forGender, note)
      if (r.ok) {
        toast.success(r.pending ? 'Thank you! Your idea will show once the parents-to-be have seen it.' : `Thank you! “${name.trim()}” is on the list.`)
        setName('')
        setNote('')
        await load(guest.token)
      } else if (r.reason === 'limit') toast.error(`That’s ${r.limit ?? 'all'} ideas from you already — remove one to add another.`)
      else if (r.reason === 'duplicate') toast.error('You’ve already suggested that name.')
      else if (r.reason === 'who') setGuest(null)
      else if (r.reason === 'closed') toast.error('Name ideas are closed right now.')
      else toast.error('Please keep the name under 40 characters.')
    } catch (err) {
      toast.error(toFriendlyMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!guest) return
    try {
      await removeNameIdea(guest.token, id)
      await load(guest.token)
    } catch (err) {
      toast.error(toFriendlyMessage(err))
    }
  }

  return (
    <ShowerShell title="Name Ideas" intro={info?.visible ? 'We’re still choosing! Suggest a name you love for our little one — maybe yours will be the one.' : undefined}>
      {!info && !error ? (
        <PageLoader label="Loading the name ideas" />
      ) : error && !info ? (
        <p className="text-center text-ink-soft">{error}</p>
      ) : info && info.private ? (
        <KeptFor section="names" what="Name ideas" onReady={setGuest} />
      ) : info && !info.visible ? (
        <NotYet what="Name ideas" />
      ) : info ? (
        <div className="space-y-10">
          {guest ? (
            <form onSubmit={submit} className="fine-frame mx-auto max-w-xl space-y-5 rounded-2xl border border-line bg-paper p-6 shadow-soft sm:p-8">
              <SignedInAs
                name={guest.name}
                onSwitch={() => {
                  forgetKnownGuest()
                  setGuest(null)
                }}
              />
              <TextField label="Your name idea" value={name} onChange={setName} maxLength={40} placeholder="e.g. Sofia, Gabriel" required />
              <div role="radiogroup" aria-label="For a girl or a boy" className="grid grid-cols-3 gap-1 rounded-lg bg-cream p-1">
                {FOR.map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    role="radio"
                    aria-checked={forGender === o.v}
                    onClick={() => setFor(o.v)}
                    className={cn('min-h-10 rounded-md px-2 text-sm transition', forGender === o.v ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
              <TextField label="Why this name? (optional)" value={note} onChange={setNote} maxLength={200} placeholder="It means “wisdom”…" />
              <Button type="submit" fullWidth loading={saving} loadingText="Saving…" disabled={!name.trim()} className="lux-cta">
                Suggest this name
              </Button>
              {info.mine.length > 0 && (
                <div className="border-t border-line pt-4">
                  <p className="text-sm font-medium text-ink">
                    Your ideas ({info.mine.length} of {info.perGuest})
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {info.mine.map((m) => (
                      <li key={m.id} className="flex items-center gap-2 text-sm">
                        <span className="font-serif text-lg text-ink">{m.suggestion}</span>
                        {m.status === 'pending' && <Badge tone="gray">Waiting</Badge>}
                        <button type="button" aria-label={`Remove ${m.suggestion}`} onClick={() => void remove(m.id)} className="ml-auto grid size-8 place-items-center rounded-md text-muted hover:text-rose">
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </form>
          ) : (
            <GuestGate why="So the parents-to-be know who suggested it — others see your first name and initial." onReady={setGuest} />
          )}
          <NameCloud ideas={ideas} />
        </div>
      ) : null}
    </ShowerShell>
  )
}
