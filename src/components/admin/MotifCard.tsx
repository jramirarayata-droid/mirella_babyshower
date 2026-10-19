import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Plus, Save, X } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import { setCachedWeddingSettings } from '../../hooks/useWeddingSettings'
import { getWeddingSettings, newSectionId, updateMotif } from '../../services/settingsService'
import type { MotifSettings } from '../../types/wedding'
import { toFriendlyMessage } from '../../utils/errors'
import { Button } from '../ui/Button'
import { TextField } from '../ui/FormField'
import { Skeleton } from '../ui/Skeleton'
import { MotifSwatches } from '../wedding/MotifSwatches'
import { useUnsavedChanges } from '../../hooks/unsavedChanges'
import { SaveStatus } from '../../components/ui/SaveStatus'

const MAX = 12

/** Dress-code motif colours (shown with the attire inspiration on the home page). */
export function MotifCard() {
  const toast = useToast()
  const [id, setId] = useState<string | null>(null)
  const [values, setValues] = useState<MotifSettings | null>(null)
  const [savedJson, setSavedJson] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getWeddingSettings()
      .then((s) => {
        const v = { motifTitle: s.motifTitle, motifColors: s.motifColors }
        setId(s.id)
        setValues(v)
        setSavedJson(JSON.stringify(v))
      })
      .catch((e) => toast.error(toFriendlyMessage(e)))
  }, [toast])

  const dirty = Boolean(values) && JSON.stringify(values) !== savedJson
  useUnsavedChanges(dirty, 'Motif colours')
  if (!values || !id) return <Skeleton className="mb-6 h-48" />

  const colors = values.motifColors
  const setColors = (motifColors: MotifSettings['motifColors']) => setValues({ ...values, motifColors })

  const moveColor = (i: number, dir: -1 | 1) => {
    const t = i + dir
    if (t < 0 || t >= colors.length) return
    const next = [...colors]
    ;[next[i], next[t]] = [next[t], next[i]]
    setColors(next)
  }

  const save = async () => {
    setSaving(true)
    try {
      const s = await updateMotif(id, values)
      setCachedWeddingSettings(s)
      const v = { motifTitle: s.motifTitle, motifColors: s.motifColors }
      setValues(v)
      setSavedJson(JSON.stringify(v))
      toast.success('Motif colours saved.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="motif-heading" className="mb-6 rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="motif-heading" className="text-2xl text-ink">
            Motif Colours
          </h2>
          <p className="mt-1 text-sm text-muted">Shown above the outfit ideas. Remove all colours to hide them.</p>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus dirty={dirty} saving={saving} />
          <Button onClick={() => void save()} loading={saving} loadingText="Saving…" disabled={!dirty} icon={<Save aria-hidden="true" className="size-4" />}>
            Save colours
          </Button>
        </div>
      </div>

      <TextField label="Label" value={values.motifTitle} onChange={(v) => setValues({ ...values, motifTitle: v })} maxLength={60} className="max-w-sm" />

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {colors.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 rounded-lg border border-line p-2.5">
            <label className="sr-only" htmlFor={`color-${c.id}`}>
              Colour {i + 1}
            </label>
            <input
              id={`color-${c.id}`}
              type="color"
              value={c.hex}
              onChange={(e) => setColors(colors.map((x) => (x.id === c.id ? { ...x, hex: e.target.value } : x)))}
              className="size-11 shrink-0 cursor-pointer rounded-md border border-line bg-transparent p-0.5"
            />
            <label className="sr-only" htmlFor={`color-name-${c.id}`}>
              Colour {i + 1} name
            </label>
            <input
              id={`color-name-${c.id}`}
              value={c.name}
              maxLength={30}
              placeholder="Name, e.g. Sage"
              onChange={(e) => setColors(colors.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
              className="input-base min-h-11 min-w-0 flex-1 py-2"
            />
            <button type="button" onClick={() => moveColor(i, -1)} disabled={i === 0} aria-label="Move left" className="rounded p-1.5 text-muted hover:bg-cream disabled:opacity-30">
              <ArrowLeft className="size-4" />
            </button>
            <button type="button" onClick={() => moveColor(i, 1)} disabled={i === colors.length - 1} aria-label="Move right" className="rounded p-1.5 text-muted hover:bg-cream disabled:opacity-30">
              <ArrowRight className="size-4" />
            </button>
            <button type="button" onClick={() => setColors(colors.filter((x) => x.id !== c.id))} aria-label={`Remove ${c.name || 'colour'}`} className="rounded p-1.5 text-muted hover:bg-rose/10 hover:text-rose">
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      {colors.length < MAX && (
        <Button
          variant="subtle"
          size="sm"
          className="mt-3"
          icon={<Plus aria-hidden="true" className="size-4" />}
          onClick={() => setColors([...colors, { id: newSectionId(), name: '', hex: '#B89B6A' }])}
        >
          Add colour
        </Button>
      )}

      {colors.length > 0 && (
        <div className="mt-6 rounded-lg bg-cream/60 px-4 py-6">
          <p className="mb-2 text-center text-xs uppercase tracking-[0.2em] text-muted">Preview</p>
          <MotifSwatches title={values.motifTitle} colors={colors} />
        </div>
      )}
    </section>
  )
}
