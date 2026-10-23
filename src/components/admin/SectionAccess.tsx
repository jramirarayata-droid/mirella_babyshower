import { useEffect, useState, type ReactNode } from 'react'
import { EyeOff, Globe, LockKeyhole, Mail, PartyPopper } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import { getSectionAudiences, saveSectionAudience, type AccessSection, type Audience } from '../../services/showerService'
import { toFriendlyMessage } from '../../utils/errors'
import { cn } from '../ui/cn'
import { Badge } from '../ui/Badge'

type Choice = 'hidden' | Audience

const CHOICES: { id: Choice; title: string; text: string; icon: typeof Globe }[] = [
  { id: 'hidden', title: 'Hidden', text: 'Not shown anywhere. Everything stays saved.', icon: EyeOff },
  { id: 'website', title: 'Website', text: 'Anyone with the website link.', icon: Globe },
  { id: 'website_invite', title: 'Website + invitation', text: 'On the website, plus a link on each guest’s invitation and RSVP confirmation.', icon: Mail },
  { id: 'invite', title: 'Invited guests only', text: 'Not on the public website. Guests open it from their invitation, or by typing their name.', icon: LockKeyhole },
  { id: 'attending', title: 'Attending guests only', text: 'Opens after a guest RSVPs “attending” — on their confirmation, their invitation and the menu.', icon: PartyPopper },
]

/**
 * "Who sees it" for one section — one choice instead of separate switches.
 * Hidden is the section's own on/off (passed in, saved by the page); the other
 * choices are saved here straight away. The database checks it for every
 * guest, so a section can't be opened by someone it isn't meant for.
 */
export function SectionAccess({
  what,
  hidden,
  onHiddenChange,
  timing,
  className,
}: {
  what: AccessSection
  /** null while the page is loading. */
  hidden: boolean | null
  /** Switch the section off (true) or on (false). Throw to undo. */
  onHiddenChange: (hidden: boolean) => void | Promise<void>
  /** When it starts showing (shown under the choices while it isn't hidden). */
  timing?: ReactNode
  className?: string
}) {
  const toast = useToast()
  const [who, setWho] = useState<Audience | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSectionAudiences()
      .then((a) => setWho(a[what]))
      .catch((e) => toast.error(toFriendlyMessage(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [what])

  const current: Choice | null = hidden === null || who === null ? null : hidden ? 'hidden' : who

  const choose = async (c: Choice) => {
    if (busy || c === current || hidden === null || who === null) return
    setBusy(true)
    try {
      if (c === 'hidden') {
        await onHiddenChange(true)
      } else {
        if (c !== who) {
          await saveSectionAudience(what, c)
          setWho(c)
        }
        if (hidden) await onHiddenChange(false)
        toast.success('Saved.')
      }
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <fieldset className={cn('text-sm', className)} disabled={current === null || busy}>
      <legend className="mb-2 font-medium text-ink">Who sees it</legend>
      <div role="radiogroup" aria-label="Who sees it" className="grid gap-1.5">
        {CHOICES.map(({ id, title, text, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={current === id}
            onClick={() => void choose(id)}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition disabled:opacity-60',
              current === id ? 'border-ink bg-ink/[0.03] ring-1 ring-ink' : 'border-line hover:border-champagne',
            )}
          >
            <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border', current === id ? 'border-ink' : 'border-line')}>
              {current === id && <span className="size-2 rounded-full bg-ink" />}
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 font-medium text-ink">
                <Icon aria-hidden="true" className="size-4 text-gold" strokeWidth={1.6} /> {title}
                {id === 'website' && <Badge tone="gray">Default</Badge>}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{text}</span>
            </span>
          </button>
        ))}
      </div>
      {current !== null && current !== 'hidden' && timing && <div className="mt-3">{timing}</div>}
    </fieldset>
  )
}
