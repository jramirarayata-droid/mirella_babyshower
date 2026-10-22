import { useEffect, useState } from 'react'
import { useToast } from '../../hooks/useToast'
import { getRsvpExtrasAdmin, saveRsvpExtra, type RsvpExtras } from '../../services/showerService'
import { toFriendlyMessage } from '../../utils/errors'
import { cn } from '../ui/cn'

const NAMES: Record<keyof RsvpExtras, string> = { wishlist: 'the wishlist', ideas: 'the gift ideas', attire: 'What to Wear' }

/**
 * Whether the RSVP confirmation offers a link to this part ("Just for you").
 * On by default; switching it off only removes the link there — the part
 * itself stays on the website as set above. Saves as soon as it changes.
 */
export function OnRsvpSwitch({ what, className }: { what: keyof RsvpExtras; className?: string }) {
  const toast = useToast()
  const [on, setOn] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getRsvpExtrasAdmin()
      .then((x) => setOn(x[what]))
      .catch(() => undefined)
  }, [what])

  const change = async (next: boolean) => {
    setSaving(true)
    try {
      await saveRsvpExtra(what, next)
      setOn(next)
      toast.success(next ? `Saved. The RSVP confirmation links to ${NAMES[what]}.` : `Saved. The RSVP confirmation no longer links to ${NAMES[what]}.`)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm has-[:checked]:border-champagne has-[:checked]:bg-champagne-light/30', className)}>
      <input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={on === true} disabled={on === null || saving} onChange={(e) => void change(e.target.checked)} />
      <span>
        <span className="font-medium text-ink">Show on the RSVP confirmation</span>
        <span className="mt-0.5 block text-muted">A “Just for you” link guests see after they RSVP “attending”.</span>
      </span>
    </label>
  )
}
