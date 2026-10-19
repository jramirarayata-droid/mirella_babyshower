import { useEffect, useState } from 'react'
import { Info, LockKeyhole } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import { toFriendlyMessage } from '../../utils/errors'
import {
  DEFAULT_WEBSITE_PRIVACY,
  getVirtualInviteSettings,
  getWebsitePrivacy,
  saveWebsitePrivacy,
  type VirtualInviteSettings,
  type WebsitePrivacy,
} from '../../services/adminDisplayService'

/**
 * Website Settings → Privacy: details the public website keeps for confirmed
 * guests (they still see them on their virtual invitation). Saves on its own,
 * as soon as a switch changes.
 */
export function WebsitePrivacyCard() {
  const toast = useToast()
  const [value, setValue] = useState<WebsitePrivacy>(DEFAULT_WEBSITE_PRIVACY)
  const [invite, setInvite] = useState<VirtualInviteSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getWebsitePrivacy().then(setValue).catch(() => undefined)
    getVirtualInviteSettings().then(setInvite).catch(() => undefined)
  }, [])

  const change = async (patch: Partial<WebsitePrivacy>) => {
    const next = { ...value, ...patch }
    setValue(next)
    setSaving(true)
    try {
      await saveWebsitePrivacy(next)
      toast.success('Privacy saved.')
    } catch (e) {
      setValue(value)
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const recommend: string[] = []
  if (invite?.hideVenues && !value.hideVenues) recommend.push('ceremony and reception')
  if (invite?.hideInfo && !value.hideInfo) recommend.push('“Good to know”')

  return (
    <section className="rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
      <div className="mb-5">
        <h2 className="flex items-center gap-2 text-2xl text-ink">
          <LockKeyhole aria-hidden="true" className="size-5 text-gold" strokeWidth={1.6} /> Privacy
        </h2>
        <p className="mt-1 text-sm text-muted">
          Keep details for confirmed guests only. The website shows a short note instead; guests who confirm see everything on their virtual invitation. Saved as soon as you change it.
        </p>
      </div>
      <div className="space-y-2">
        {(
          [
            ['hideVenues', 'Keep ceremony and reception private', 'Hides the Ceremony and Reception section (names, times and maps).'],
            ['hideInfo', 'Keep “Good to know” private', 'Hides the information sections below.'],
          ] as const
        ).map(([key, label, hint]) => (
          <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm has-[:checked]:border-champagne has-[:checked]:bg-champagne-light/30">
            <input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={value[key]} disabled={saving} onChange={(e) => change({ [key]: e.target.checked } as Partial<WebsitePrivacy>)} />
            <span>
              <span className="font-medium text-ink">{label}</span>
              <span className="mt-0.5 block text-muted">{hint}</span>
            </span>
          </label>
        ))}
      </div>
      {recommend.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-champagne/60 bg-champagne-light/40 p-3 text-sm text-ink-soft">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gold" />
          <span>
            <span className="font-medium text-ink">Recommended:</span> your virtual invitation keeps the {recommend.join(' and ')} private, but {recommend.length > 1 ? 'they are' : 'it is'} still
            public here.
          </span>
        </p>
      )}
    </section>
  )
}
