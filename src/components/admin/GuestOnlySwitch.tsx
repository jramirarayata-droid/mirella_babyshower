import { useEffect, useState } from 'react'
import { Globe, LockKeyhole } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import { getWebsitePrivacy, saveWebsitePrivacy, type WebsitePrivacy } from '../../services/adminDisplayService'
import { toFriendlyMessage } from '../../utils/errors'
import { cn } from '../ui/cn'

/**
 * Who can see a part of the website: everyone, or only guests who RSVP'd
 * "attending". The same setting as Website Settings → Privacy (one place
 * changes both); the database enforces it. Saves as soon as it changes.
 */
export function GuestOnlySwitch({ what, className, stacked = false }: { what: 'attire' | 'wishlist'; className?: string; /** One option per row (narrow side panels). */ stacked?: boolean }) {
  const toast = useToast()
  const key: keyof WebsitePrivacy = what === 'attire' ? 'hideAttire' : 'hideWishlist'
  const [privacy, setPrivacy] = useState<WebsitePrivacy | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getWebsitePrivacy()
      .then(setPrivacy)
      .catch(() => undefined)
  }, [])

  const choose = async (guestOnly: boolean) => {
    if (!privacy || privacy[key] === guestOnly) return
    // Read the latest first, so a change made in Privacy meanwhile isn't undone.
    setSaving(true)
    try {
      const latest = await getWebsitePrivacy()
      const next = { ...latest, [key]: guestOnly }
      await saveWebsitePrivacy(next)
      setPrivacy(next)
      toast.success(guestOnly ? 'Saved. Only guests who RSVP “attending” can see it.' : 'Saved. Everyone can see it.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const label = what === 'attire' ? 'Who can see the outfit photos' : 'Who can see the wishlist'
  const current = privacy?.[key]
  return (
    <fieldset className={cn('text-sm', className)} disabled={!privacy || saving}>
      <legend className="mb-2 font-medium text-ink">{label}</legend>
      <div role="radiogroup" aria-label={label} className={cn('grid gap-2', !stacked && 'sm:grid-cols-2')}>
        {(
          [
            [false, 'Everyone', 'Anyone with the website link.', Globe],
            [true, 'Only guests who RSVP “attending”', 'They get it on their RSVP confirmation and in the menu.', LockKeyhole],
          ] as const
        ).map(([value, title, hint, Icon]) => (
          <button
            key={String(value)}
            type="button"
            role="radio"
            aria-checked={current === value}
            onClick={() => void choose(value)}
            className={cn(
              'flex items-start gap-2.5 rounded-lg border p-3 text-left transition disabled:opacity-60',
              current === value ? 'border-ink bg-champagne-light/40' : 'border-line hover:border-champagne',
            )}
          >
            <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', current === value ? 'text-ink' : 'text-gold')} />
            <span>
              <span className="block font-medium text-ink">{title}</span>
              <span className="mt-0.5 block text-xs text-muted">{hint}</span>
            </span>
          </button>
        ))}
      </div>
      {what === 'attire' && current === true && <p className="mt-2 text-xs text-muted">The motif colours still show to everyone, so guests know the colour theme.</p>}
    </fieldset>
  )
}
