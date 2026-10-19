import { useEffect, useMemo, useState } from 'react'
import { Bold, Check, EyeOff, Info } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { TextAreaField } from '../ui/FormField'
import { cn } from '../ui/cn'
import { DEFAULT_INVITE_MESSAGE, INVITE_PLACEHOLDERS, buildInviteMessage } from '../../utils/inviteMessage'
import type { VirtualInviteSettings, WebsitePrivacy } from '../../services/adminDisplayService'
import type { InfoSection } from '../../types/wedding'

type Tab = 'message' | 'guests'

interface Props {
  open: boolean
  template: string
  settings: VirtualInviteSettings
  website: WebsitePrivacy
  /** Visible "Good to know" sections from Website Settings. */
  sections: InfoSection[]
  /** What Printables has ticked (null = the first three). */
  printablesIds: string[] | null
  saving: boolean
  hidingOnWebsite: boolean
  /** Used for the message preview. */
  sample: { name: string; date: string; couple: string; link: string }
  onClose: () => void
  onSave: (text: string, settings: VirtualInviteSettings) => void
  onHideOnWebsite: (patch: Partial<WebsitePrivacy>) => void
}

/** Admin → Invitations: the message copied with each link, and what guests see on their virtual invitation. */
export function VirtualInviteSettingsModal(p: Props) {
  const [tab, setTab] = useState<Tab>('message')
  const [text, setText] = useState(p.template)
  const [s, setS] = useState<VirtualInviteSettings>(p.settings)

  useEffect(() => {
    if (!p.open) return
    setText(p.template)
    setS(p.settings)
  }, [p.open, p.template, p.settings])

  const preview = useMemo(() => buildInviteMessage(text, p.sample), [text, p.sample])
  const insert = (key: string) => setText((t) => (t.endsWith('\n') || !t ? t + key : `${t} ${key}`))
  const set = (patch: Partial<VirtualInviteSettings>) => setS((x) => ({ ...x, ...patch }))

  const printablesPicked = useMemo(() => {
    const ids = new Set(p.printablesIds ?? p.sections.slice(0, 3).map((x) => x.id))
    return p.sections.filter((x) => ids.has(x.id))
  }, [p.printablesIds, p.sections])

  const startCustom = () => {
    // Start from what's on the printed card, so switching is a small step.
    set({ backMode: 'custom', backIds: s.backIds.length ? s.backIds : printablesPicked.map((x) => x.id) })
  }
  const toggleIn = (key: 'backIds' | 'boldIds', id: string) => {
    const list = new Set(s[key])
    if (list.has(id)) list.delete(id)
    else list.add(id)
    set({ [key]: [...list] } as Partial<VirtualInviteSettings>)
  }

  // Private on the card but still public on the website → recommend hiding there too.
  const stillPublic: { key: keyof WebsitePrivacy; label: string }[] = []
  if (s.hideVenues && !p.website.hideVenues) stillPublic.push({ key: 'hideVenues', label: 'ceremony and reception' })
  if (s.hideInfo && !p.website.hideInfo) stillPublic.push({ key: 'hideInfo', label: '“Good to know”' })

  return (
    <Modal
      open={p.open}
      onClose={p.onClose}
      locked={p.saving}
      size="lg"
      title="Virtual invitation settings"
      description="The message you copy for each guest, and what they see when they open their invitation."
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={p.onClose} disabled={p.saving}>
            Cancel
          </Button>
          <Button onClick={() => p.onSave(text, s)} loading={p.saving} loadingText="Saving…">
            Save settings
          </Button>
        </div>
      }
    >
      <div role="tablist" aria-label="Settings" className="mb-6 inline-flex rounded-full bg-cream p-1">
        {(
          [
            ['message', 'Message'],
            ['guests', 'What guests see'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn('min-h-9 rounded-full px-4 text-sm transition', tab === id ? 'bg-paper font-medium text-ink shadow-soft' : 'text-muted hover:text-ink')}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'message' ? (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <TextAreaField label="Message" value={text} onChange={setText} rows={11} maxLength={1500} showCounter />
            <p className="mt-3 text-sm text-muted">Tap to add:</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {INVITE_PLACEHOLDERS.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => insert(x.key)}
                  className="rounded-full border border-line bg-paper px-3 py-1 text-xs text-ink-soft transition hover:border-champagne hover:text-ink"
                >
                  {x.label} <span className="text-muted">{x.key}</span>
                </button>
              ))}
            </div>
            {!/\{link\}/i.test(text) && <p className="mt-3 text-sm text-muted">The link will be added at the end.</p>}
            <button type="button" onClick={() => setText(DEFAULT_INVITE_MESSAGE)} className="mt-4 text-sm text-gold underline-offset-4 hover:underline">
              Use the suggested message
            </button>
          </div>
          <div>
            <p className="mb-2 text-[0.95rem] font-medium text-ink-soft">Preview</p>
            <div className="whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-cream px-4 py-3 text-[0.95rem] leading-relaxed text-ink">{preview}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h3 className="text-lg text-ink">“Good to know” on the back of the card</h3>
            <div className="mt-3 space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm has-[:checked]:border-champagne has-[:checked]:bg-champagne-light/30">
                <input type="radio" name="back-mode" className="mt-0.5 size-4 accent-ink" checked={s.backMode === 'printables'} onChange={() => set({ backMode: 'printables' })} />
                <span>
                  <span className="font-medium text-ink">Same as the printed card</span>
                  <span className="mt-0.5 block text-muted">
                    {printablesPicked.length ? printablesPicked.map((x) => x.title || 'Untitled').join(', ') : 'Nothing ticked in Printables'} — change it in Printables.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm has-[:checked]:border-champagne has-[:checked]:bg-champagne-light/30">
                <input type="radio" name="back-mode" className="mt-0.5 size-4 accent-ink" checked={s.backMode === 'custom'} onChange={startCustom} />
                <span>
                  <span className="font-medium text-ink">Choose for the virtual invitation</span>
                  <span className="mt-0.5 block text-muted">Pick the sections below; the printed card stays as it is.</span>
                </span>
              </label>
            </div>
            {s.backMode === 'custom' && (
              <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
                {p.sections.length === 0 && <li className="p-3 text-sm text-muted">Add “Good to know” sections in Website Settings first.</li>}
                {p.sections.map((x) => {
                  const on = s.backIds.includes(x.id)
                  const bold = s.boldIds.includes(x.id)
                  return (
                    <li key={x.id} className="flex items-center gap-3 px-3 py-2">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm text-ink-soft">
                        <input type="checkbox" className="size-4 accent-ink" checked={on} onChange={() => toggleIn('backIds', x.id)} />
                        <span className={cn('truncate', on && 'text-ink', on && bold && 'font-semibold')}>{x.title || 'Untitled'}</span>
                      </label>
                      {on && (
                        <button
                          type="button"
                          onClick={() => toggleIn('boldIds', x.id)}
                          aria-pressed={bold}
                          aria-label={`Bold title for ${x.title || 'this section'}`}
                          className={cn('rounded p-1.5 transition', bold ? 'bg-ink text-ivory' : 'text-muted hover:bg-cream hover:text-ink')}
                        >
                          <Bold aria-hidden="true" className="size-3.5" />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-lg text-ink">Keep private until a guest confirms they’re attending</h3>
            <p className="mt-1 text-sm text-muted">Guests who decline keep the private version.</p>
            <div className="mt-3 space-y-2">
              {(
                [
                  ['hideVenues', 'Ceremony and reception', 'On the front of the card, a short note says details are shared once they confirm.'],
                  ['hideInfo', '“Good to know”', 'The back of the card shows just your monogram, names and date.'],
                  ['hideLinks', 'Maps and Add to calendar', 'The links under the card.'],
                ] as const
              ).map(([key, label, hint]) => (
                <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm has-[:checked]:border-champagne has-[:checked]:bg-champagne-light/30">
                  <input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={s[key]} onChange={(e) => set({ [key]: e.target.checked } as Partial<VirtualInviteSettings>)} />
                  <span>
                    <span className="font-medium text-ink">{label}</span>
                    <span className="mt-0.5 block text-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </div>

            {stillPublic.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 rounded-lg border border-champagne/60 bg-champagne-light/40 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-ink-soft">
                  <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gold" />
                  <span>
                    <span className="font-medium text-ink">Recommended:</span> your {stillPublic.map((x) => x.label).join(' and ')} {stillPublic.length > 1 ? 'are' : 'is'} still public on
                    your wedding website.
                  </span>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  loading={p.hidingOnWebsite}
                  loadingText="Hiding…"
                  onClick={() => p.onHideOnWebsite(Object.fromEntries(stillPublic.map((x) => [x.key, true])) as Partial<WebsitePrivacy>)}
                  icon={<EyeOff aria-hidden="true" className="size-3.5" />}
                >
                  Hide on website
                </Button>
              </div>
            )}
            {(s.hideVenues || s.hideInfo) && stillPublic.length === 0 && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-sage">
                <Check aria-hidden="true" className="size-4" /> Also private on your wedding website.
              </p>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}
