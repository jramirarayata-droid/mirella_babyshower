import { useEffect, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Plus, Save, Trash2, Wand2 } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import { setCachedWeddingSettings } from '../../hooks/useWeddingSettings'
import { useUnsavedChanges } from '../../hooks/unsavedChanges'
import { getWeddingSettings, updateProgramSettings } from '../../services/settingsService'
import { cleanProgram, listProgram, newProgramItemId, PROGRAM_LIMIT, saveProgram } from '../../services/programService'
import type { ProgramItem, ProgramSettings } from '../../types/wedding'
import { toFriendlyMessage } from '../../utils/errors'
import { ProgramTimeline } from '../wedding/ProgramFlow'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { TextField } from '../ui/FormField'
import { SaveStatus } from '../ui/SaveStatus'
import { Skeleton } from '../ui/Skeleton'

const item = (time: string, title: string, description = ''): ProgramItem => ({ id: newProgramItemId(), time, title, description })

/** A typical baby shower afternoon to start from (every line can be changed). */
function starterProgram(startTime: string): ProgramItem[] {
  return [
    item(startTime || '2:00 PM', 'Welcome & Snacks', 'Sign the guest book and grab a treat'),
    item('', 'Opening Prayer'),
    item('', 'Shower Games', 'Baby bingo, guess the bump and more'),
    item('', 'Baby Predictions', 'Due date, weight and boy or girl'),
    item('', 'Lunch / Merienda'),
    item('', 'Gender Reveal'),
    item('', 'Diaper Raffle'),
    item('', 'Wishes for the Baby'),
    item('', 'Opening of Gifts & Thank You'),
  ]
}

/** Admin → Website Settings: the program / order of the day (its own table), shown on the website and in Printables. */
export function ProgramCard() {
  const toast = useToast()
  const [id, setId] = useState<string | null>(null)
  const [startTime, setStartTime] = useState('')
  const [saved, setSaved] = useState<{ settings: ProgramSettings; items: ProgramItem[] } | null>(null)
  const [settings, setSettings] = useState<ProgramSettings>({ programVisible: false, programTitle: '', programSubtitle: '' })
  const [items, setItems] = useState<ProgramItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([getWeddingSettings(), listProgram()])
      .then(([s, list]) => {
        if (!active) return
        const ps: ProgramSettings = { programVisible: s.programVisible, programTitle: s.programTitle, programSubtitle: s.programSubtitle }
        setId(s.id)
        setStartTime(s.ceremonyTime)
        setSaved({ settings: ps, items: list })
        setSettings(ps)
        setItems(list)
      })
      .catch((e) => active && setError(toFriendlyMessage(e)))
    return () => {
      active = false
    }
  }, [])

  const dirty = Boolean(saved) && JSON.stringify({ settings, items }) !== JSON.stringify({ settings: saved!.settings, items: saved!.items })
  useUnsavedChanges(dirty, 'the program')

  if (error) {
    return (
      <section aria-labelledby="program-heading-admin" className="rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
        <h2 id="program-heading-admin" className="text-2xl text-ink">
          Program flow
        </h2>
        <p role="alert" className="mt-3 text-sm text-rose">
          {error}
        </p>
      </section>
    )
  }
  if (!saved) return <Skeleton className="h-72" />

  const set = (patch: Partial<ProgramSettings>) => setSettings((v) => ({ ...v, ...patch }))
  const update = (itemId: string, patch: Partial<ProgramItem>) => setItems((list) => list.map((x) => (x.id === itemId ? { ...x, ...patch } : x)))
  const move = (i: number, d: -1 | 1) =>
    setItems((list) => {
      const j = i + d
      if (j < 0 || j >= list.length) return list
      const next = [...list]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const add = () => {
    if (items.length >= PROGRAM_LIMIT) return
    const it = item('', '')
    setItems((list) => [...list, it])
    window.setTimeout(() => document.getElementById(`program-time-${it.id}`)?.focus(), 60)
  }
  const missingTitle = (it: ProgramItem) => !it.title.trim() && Boolean(it.time.trim() || it.description.trim())
  const ready = cleanProgram(items)

  const save = async () => {
    if (!id) return
    if (items.some(missingTitle)) {
      setShowErrors(true)
      toast.error('Every moment needs a name — or clear the row.')
      return
    }
    if (settings.programVisible && ready.length === 0) {
      toast.error('Add at least one moment, or turn the program off.')
      return
    }
    setSaving(true)
    try {
      const list = await saveProgram(items)
      const s = await updateProgramSettings(id, settings)
      setCachedWeddingSettings(s)
      const ps: ProgramSettings = { programVisible: s.programVisible, programTitle: s.programTitle, programSubtitle: s.programSubtitle }
      setSaved({ settings: ps, items: list })
      setSettings(ps)
      setItems(list)
      setShowErrors(false)
      toast.success(ps.programVisible ? 'Program saved — guests see it on the website.' : 'Program saved (hidden from guests).')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="program" aria-labelledby="program-heading-admin" className="scroll-mt-24 rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="program-heading-admin" className="text-2xl text-ink">
            Program flow
          </h2>
          <p className="mt-1 text-sm text-muted">The order of the day, moment by moment. Shown on the website, and ready to print in Printables → Leaflets.</p>
        </div>
        <Badge tone={saved.settings.programVisible ? 'green' : 'gray'}>{saved.settings.programVisible ? 'Showing' : 'Hidden'}</Badge>
      </div>

      <div className="space-y-5">
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-line bg-ivory/60 px-4 py-3.5">
          <span>
            <span className="block text-[0.95rem] font-medium text-ink-soft">Show the program on the website</span>
            <span className="block text-sm text-muted">Off = saved and printable, but guests don’t see it.</span>
          </span>
          <input type="checkbox" checked={settings.programVisible} onChange={(e) => set({ programVisible: e.target.checked })} className="size-5 shrink-0 accent-ink" />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label="Section title" value={settings.programTitle} onChange={(v) => set({ programTitle: v })} maxLength={80} placeholder="Program" />
          <TextField label="Subtitle (optional)" value={settings.programSubtitle} onChange={(v) => set({ programSubtitle: v })} maxLength={300} placeholder="e.g. Saturday afternoon" />
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <p className="text-[0.95rem] font-medium text-ink-soft">
              Moments <span className="font-normal text-muted">({ready.length} of up to {PROGRAM_LIMIT})</span>
            </p>
            <p className="text-xs text-muted">Time is optional, e.g. “2:00 PM” or “After lunch”.</p>
          </div>
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center">
              <p className="text-sm text-muted">No moments yet.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setItems(starterProgram(startTime))} icon={<Wand2 aria-hidden="true" className="size-4" />}>
                  Start with a typical program
                </Button>
                <Button variant="outline" size="sm" onClick={add} icon={<Plus aria-hidden="true" className="size-4" />}>
                  Add a moment
                </Button>
              </div>
            </div>
          ) : (
            <ol aria-label="Program moments" className="space-y-3">
              {items.map((it, i) => {
                const label = it.title.trim() || `moment ${i + 1}`
                return (
                  <li key={it.id} className="rounded-lg border border-line bg-ivory/60 p-3 sm:p-4">
                    <div className="grid gap-3 sm:grid-cols-[8.5rem_1fr_auto] sm:items-start">
                      <TextField id={`program-time-${it.id}`} label="Time" value={it.time} onChange={(v) => update(it.id, { time: v })} maxLength={40} placeholder="optional" />
                      <TextField
                        label="Moment"
                        value={it.title}
                        onChange={(v) => update(it.id, { title: v })}
                        maxLength={120}
                        placeholder="e.g. Shower Games"
                        error={showErrors && missingTitle(it) ? 'Please name this moment.' : undefined}
                      />
                      <div className="flex items-center gap-1 sm:pt-8">
                        <IconButton label={`Move ${label} up`} onClick={() => move(i, -1)} disabled={i === 0}>
                          <ArrowUp className="size-4" />
                        </IconButton>
                        <IconButton label={`Move ${label} down`} onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                          <ArrowDown className="size-4" />
                        </IconButton>
                        <IconButton label={`Remove ${label}`} onClick={() => setItems((list) => list.filter((x) => x.id !== it.id))} danger>
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                      <TextField
                        className="sm:col-span-2"
                        label="Note (optional)"
                        value={it.description}
                        onChange={(v) => update(it.id, { description: v })}
                        maxLength={300}
                        placeholder="e.g. Baby bingo, guess the bump and more"
                      />
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
          {items.length > 0 && (
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={add} disabled={items.length >= PROGRAM_LIMIT} icon={<Plus aria-hidden="true" className="size-4" />}>
                Add a moment
              </Button>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink-soft">Preview</p>
          <div className="rounded-lg border border-dashed border-line bg-ivory/60 px-4 py-8">
            {ready.length ? <ProgramTimeline items={ready} /> : <p className="text-center text-sm text-muted">Add a moment to see the preview.</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-line pt-5">
          <SaveStatus dirty={dirty} saving={saving} />
          <Button onClick={() => void save()} loading={saving} loadingText="Saving…" disabled={!dirty} icon={<Save aria-hidden="true" className="size-4" />}>
            Save program
          </Button>
        </div>
      </div>
    </section>
  )
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex size-10 items-center justify-center rounded-md text-muted transition disabled:opacity-30 ${danger ? 'hover:bg-rose/10 hover:text-rose' : 'hover:bg-cream hover:text-ink'}`}
    >
      {children}
    </button>
  )
}
