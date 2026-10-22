import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, CheckCircle2, ExternalLink, Lock, Monitor, RotateCcw, Save, Smartphone, TriangleAlert } from 'lucide-react'
import { useSpace } from '../hooks/useSpace'
import { useToast } from '../hooks/useToast'
import { setCachedWeddingSettings, useWeddingSettings } from '../hooks/useWeddingSettings'
import { updateTheme, uploadWeddingAsset } from '../services/settingsService'
import { writePreviewTheme } from '../theme/applyTheme'
import {
  BODY_FONTS,
  contrast,
  contrastReport,
  findTemplate,
  googleFontsHref,
  HEADING_FONTS,
  HERO_LAYOUTS,
  findStyle,
  isHex,
  clampWash,
  resolveTheme,
  ALL_STYLES,
  TEMPLATES,
  type LookId,
  type HeroLayout,
  type Template,
  type ThemeSettings,
} from '../theme/themes'
import { toFriendlyMessage } from '../utils/errors'
import { siteLinks } from '../utils/share'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { cn } from '../components/ui/cn'
import { PageHeader } from '../components/admin/PageHeader'
import { MonogramCard } from '../components/admin/MonogramCard'
import { useUnsavedChanges } from '../hooks/unsavedChanges'
import { SaveStatus } from '../components/ui/SaveStatus'

const DEVICES = {
  desktop: { w: 1280, h: 820, label: 'Desktop', icon: Monitor },
  phone: { w: 390, h: 780, label: 'Phone', icon: Smartphone },
} as const

/** Light backgrounds only — photo overlays and the invitation design assume a light page. */
const isLightEnough = (hex: string) => contrast(hex, '#000000') >= 12

export default function AdminLookFeel() {
  const toast = useToast()
  const space = useSpace()
  const { settings } = useWeddingSettings()
  const [values, setValues] = useState<ThemeSettings | null>(null)
  const [savedJson, setSavedJson] = useState('')
  const [saving, setSaving] = useState(false)
  const [device, setDevice] = useState<keyof typeof DEVICES>('desktop')
  const previewBox = useRef<HTMLDivElement>(null)
  const [boxWidth, setBoxWidth] = useState(600)
  const [styleTab, setStyleTab] = useState<LookId | null>(null)
  // A fresh address each visit, so the preview never shows an older copy of the website from the browser cache.
  const [stamp] = useState(() => Date.now().toString(36))

  useEffect(() => {
    document.title = 'Look & Feel · Baby shower admin'
  }, [])

  // Load every template's fonts once so the gallery cards show real type.
  useEffect(() => {
    const id = 'lookfeel-all-fonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = googleFontsHref([...HEADING_FONTS, ...BODY_FONTS.slice(0, 5)])
    document.head.appendChild(link)
    const link2 = document.createElement('link')
    link2.id = `${id}-2`
    link2.rel = 'stylesheet'
    link2.href = googleFontsHref([...BODY_FONTS.slice(5), ...ALL_STYLES.flatMap((st) => (st.script ? [st.script] : []))])
    document.head.appendChild(link2)
  }, [])

  useEffect(() => {
    if (settings && values === null) {
      setValues(settings.theme)
      setSavedJson(JSON.stringify(settings.theme))
    }
  }, [settings, values])

  // Push the unsaved choices to the preview frame (it listens for storage events).
  useEffect(() => {
    if (!values) return
    const t = window.setTimeout(() => writePreviewTheme(values), 120)
    return () => window.clearTimeout(t)
  }, [values])

  useEffect(() => {
    const el = previewBox.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBoxWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [values === null])

  const resolved = useMemo(() => resolveTheme(values), [values])
  const report = useMemo(() => contrastReport(resolved.palette), [resolved])

  // Before the loading return: hooks must run on every render.
  const dirty = Boolean(values) && JSON.stringify(values) !== savedJson
  useUnsavedChanges(dirty, 'Look & Feel')
  if (!values || !settings) {
    return (
      <>
        <PageHeader title="Look & Feel" />
        <Skeleton className="h-[600px]" />
      </>
    )
  }

  const template = findTemplate(values.template)
  const currentStyle = findStyle(template.style)
  const tab = styleTab ?? currentStyle.id
  const bg = values.background ?? template.background
  // Dark pages are only designed for in styles made for them (Twinkle Little Star).
  const bgTooDark = !currentStyle.allowsDark && !isLightEnough(bg)

  // A new look keeps the page background (it isn't part of the look).
  const pickTemplate = (t: Template) => setValues({ template: t.id, bgMode: values.bgMode, bgImage: values.bgImage, bgWash: values.bgWash })
  // Little Sprout: the Clouds look (any colour) and the classic style; the rest can be previewed, not published.
  const lookLocked = (id: string) => !space.has('looks_all') && !/^(classic|clouds-)/.test(id)
  const pickedLocked = lookLocked(values.template)
  const set = <K extends keyof ThemeSettings>(k: K, v: ThemeSettings[K]) => setValues({ ...values, [k]: v })
  const clear = (k: keyof ThemeSettings) => {
    const next = { ...values }
    delete next[k]
    setValues(next)
  }

  const save = async () => {
    if (pickedLocked) {
      toast.error('This look is part of the Sweet Bundle and Full Celebration plans. Message us to upgrade.')
      return
    }
    if (bgTooDark) {
      toast.error(`Please choose a lighter background colour — the ${currentStyle.name} style is designed for light pages.`)
      return
    }
    setSaving(true)
    try {
      const s = await updateTheme(settings.id, values)
      setCachedWeddingSettings(s)
      setSavedJson(JSON.stringify(s.theme))
      setValues(s.theme)
      toast.success('New look saved and live on your website.')
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const d = DEVICES[device]
  const scale = Math.min(1, boxWidth / d.w)
  const previewUrl = `${siteLinks().home}?preview=${stamp}#/?themePreview=1`

  return (
    <>
      <PageHeader
        title="Look & Feel"
        description="Choose a template, then fine-tune fonts, colours and the hero layout. The preview updates as you go."
        actions={
          <>
            <Button variant="ghost" onClick={() => setValues(JSON.parse(savedJson) as ThemeSettings)} disabled={!dirty || saving} icon={<RotateCcw aria-hidden="true" className="size-4" />}>
              Undo changes
            </Button>
            <SaveStatus dirty={dirty} saving={saving} />
            <Button onClick={() => void save()} loading={saving} loadingText="Saving…" disabled={!dirty || bgTooDark || pickedLocked} icon={<Save aria-hidden="true" className="size-4" />}>
              Save & publish
            </Button>
          </>
        }
      />

      {pickedLocked && (
        <p className="mb-6 flex items-center gap-2 rounded-xl border border-champagne/50 bg-champagne-light/30 px-4 py-3 text-sm text-ink-soft">
          <Lock aria-hidden="true" className="size-4 shrink-0 text-gold" />
          You’re previewing a look from a bigger plan. Your plan includes the Over the Moon (Clouds) look in every colour — message us to upgrade for the rest.
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-6">
          {/* Templates */}
          <section aria-labelledby="templates-heading" className="rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
            <h2 id="templates-heading" className="text-2xl text-ink">
              Style &amp; template
            </h2>
            <p className="mt-1 text-sm text-muted">
              A <strong className="font-medium text-ink-soft">style</strong> is the whole design — section layouts, ornaments, textures and type. Each style has
              its own templates (colour and font presets). Picking a template resets fonts, colours and layout to that template. The newer looks
              (Over the Moon, Oh Baby! Balloons, Boho Rainbow, Sweet Greenery and Little Blossom) change the website only — Printables use Soft &amp; Sweet for them, or pick a print design there.
            </p>
            <div role="tablist" aria-label="Design style" className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-cream p-1 sm:grid-cols-5">
              {ALL_STYLES.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === st.id}
                  onClick={() => setStyleTab(st.id)}
                  className={cn('relative rounded-md px-2 py-2 text-sm transition', tab === st.id ? 'bg-paper font-medium text-ink shadow-soft' : 'text-muted hover:text-ink')}
                >
                  {st.name}
                  {currentStyle.id === st.id && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-gold" aria-label="(in use)" />}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-ink-soft">{findStyle(tab).description}</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {TEMPLATES.filter((t) => (t.style ?? 'classic') === tab).map((t) => {
                const selected = t.id === values.template
                const r = resolveTheme({ template: t.id })
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => pickTemplate(t)}
                      aria-pressed={selected}
                      className={cn(
                        'group relative block w-full overflow-hidden rounded-lg border text-left transition',
                        selected ? 'border-ink ring-2 ring-ink/15' : 'border-line hover:border-champagne hover:shadow-soft',
                      )}
                    >
                      <div className="flex h-28 flex-col items-center justify-center px-3 text-center" style={{ background: r.palette.ivory, color: r.palette.ink }}>
                        <span className="text-[0.55rem] uppercase tracking-[0.3em]" style={{ color: r.palette.gold, fontFamily: `"${r.body.family}"` }}>
                          Join us for a baby shower
                        </span>
                        <span className="mt-1 text-[1.7rem] leading-none" style={{ fontFamily: `"${(r.script ?? r.heading).family}", serif` }}>
                          Little One
                        </span>
                        <span className="mt-2 flex items-center gap-1.5" aria-hidden="true">
                          <span className="h-px w-6" style={{ background: r.palette.champagne }} />
                          <svg viewBox="0 0 24 24" className="size-2.5" style={{ color: r.palette.champagne }}>
                            <path d="M12 1.5c.5 5.6 2.3 8.6 10.5 10.5-8.2 1.9-10 4.9-10.5 10.5C11.5 16.9 9.7 13.9 1.5 12 9.7 10.1 11.5 7.1 12 1.5Z" fill="currentColor" />
                          </svg>
                          <span className="h-px w-6" style={{ background: r.palette.champagne }} />
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-2 border-t border-line bg-paper px-3 py-2.5">
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                            {t.name}
                            {lookLocked(t.id) && <Lock aria-label="Bigger plan" className="size-3 text-muted" />}
                          </span>
                          <span className="block truncate text-xs text-muted">{t.description}</span>
                        </span>
                        <span className="flex shrink-0 gap-1 pt-0.5" aria-hidden="true">
                          {[t.background, t.text, t.accent].map((c) => (
                            <span key={c} className="size-3.5 rounded-full ring-1 ring-black/10" style={{ background: c }} />
                          ))}
                        </span>
                      </div>
                      {selected && (
                        <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-ink text-ivory">
                          <Check className="size-3.5" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>

          {/* Fine-tune */}
          <section aria-labelledby="finetune-heading" className="rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6">
            <h2 id="finetune-heading" className="text-2xl text-ink">
              Fine-tune
            </h2>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <FontSelect
                label="Heading font"
                value={values.headingFont ?? template.headingFont}
                options={HEADING_FONTS}
                onChange={(v) => (v === template.headingFont ? clear('headingFont') : set('headingFont', v))}
                sample="Baby Santos"
                sampleClass="text-3xl"
              />
              <FontSelect
                label="Body font"
                value={values.bodyFont ?? template.bodyFont}
                options={BODY_FONTS}
                onChange={(v) => (v === template.bodyFont ? clear('bodyFont') : set('bodyFont', v))}
                sample="Will you join us for the baby shower?"
                sampleClass="text-base"
              />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <ColorField label="Background" value={values.background ?? template.background} changed={Boolean(values.background)} onChange={(v) => set('background', v)} onReset={() => clear('background')} />
              <ColorField label="Text" value={values.text ?? template.text} changed={Boolean(values.text)} onChange={(v) => set('text', v)} onReset={() => clear('text')} />
              <ColorField label="Accent" value={values.accent ?? template.accent} changed={Boolean(values.accent)} onChange={(v) => set('accent', v)} onReset={() => clear('accent')} />
            </div>
            {bgTooDark && (
              <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-rose/5 px-3 py-2 text-sm text-rose">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                This background is too dark for the {currentStyle.name} style. Choose a lighter colour, or the style made for dark pages (Twinkle Little Star).
              </p>
            )}

            <fieldset className="mt-6">
              <legend className="mb-2 text-[0.95rem] font-medium text-ink-soft">Hero layout</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {HERO_LAYOUTS.map((h) => {
                  const active = (values.heroLayout ?? template.heroLayout) === h.id
                  return (
                    <label
                      key={h.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-gold',
                        active ? 'border-ink bg-ink/[0.03]' : 'border-line hover:border-champagne',
                      )}
                    >
                      <input
                        type="radio"
                        name="hero-layout"
                        className="sr-only"
                        checked={active}
                        onChange={() => (h.id === template.heroLayout ? clear('heroLayout') : set('heroLayout', h.id as HeroLayout))}
                      />
                      <HeroThumb layout={h.id} />
                      <span>
                        <span className="block font-medium text-ink">{h.name}</span>
                        <span className="block text-xs text-muted">{h.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <PageBackgroundField
              values={values}
              heroImageUrl={settings?.heroImageUrl ?? ''}
              onChange={(patch) => {
                const next = { ...values, ...patch }
                for (const k of ['bgMode', 'bgImage', 'bgWash'] as const) if (next[k] === undefined) delete next[k]
                setValues(next)
              }}
            />

            <div className="mt-6 rounded-lg border border-line bg-ivory/60 p-4">
              <p className="text-sm font-medium text-ink-soft">Readability check</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {report.map((c) => (
                  <li key={c.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-ink-soft">
                      {c.ok ? <CheckCircle2 aria-hidden="true" className="size-4 text-sage" /> : <TriangleAlert aria-hidden="true" className="size-4 text-rose" />}
                      {c.label}
                    </span>
                    <span className={cn('tabular-nums', c.ok ? 'text-muted' : 'text-rose')}>
                      {c.ratio.toFixed(1)} : 1 {c.ok ? '' : `(needs ${c.min})`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">Shades are adjusted automatically so text always stays easy to read.</p>
            </div>
          </section>

          <MonogramCard />
        </div>

        {/* Live preview */}
        <section aria-labelledby="preview-heading" className="xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-xl border border-line bg-paper p-4 shadow-soft">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="preview-heading" className="text-2xl text-ink">
                Live preview
              </h2>
              <div className="flex items-center gap-1">
                {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((k) => {
                  const D = DEVICES[k]
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setDevice(k)}
                      aria-pressed={device === k}
                      className={cn('flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm transition', device === k ? 'bg-ink text-ivory' : 'text-muted hover:bg-cream hover:text-ink')}
                    >
                      <D.icon aria-hidden="true" className="size-4" />
                      {D.label}
                    </button>
                  )
                })}
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="ml-1 flex size-9 items-center justify-center rounded-md text-muted hover:bg-cream hover:text-ink" aria-label="Open preview in a new tab">
                  <ExternalLink className="size-4" />
                </a>
              </div>
            </div>
            <div ref={previewBox} className="flex justify-center overflow-hidden rounded-lg bg-cream">
              <div style={{ width: d.w * scale, height: d.h * scale }} className="relative">
                <iframe
                  key={device}
                  title="Website preview"
                  src={previewUrl}
                  style={{ width: d.w, height: d.h, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                  className="absolute left-0 top-0 border-0 bg-white"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">{dirty ? 'Showing your unsaved changes. Guests still see the saved look until you publish.' : 'This is what guests see.'}</p>
          </div>
        </section>
      </div>
    </>
  )
}

function FontSelect({
  label,
  value,
  options,
  onChange,
  sample,
  sampleClass,
}: {
  label: string
  value: string
  options: { id: string; family: string }[]
  onChange: (id: string) => void
  sample: string
  sampleClass: string
}) {
  const family = options.find((o) => o.id === value)?.family ?? options[0].family
  const id = `font-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[0.95rem] font-medium text-ink-soft">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input-base">
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.family}
          </option>
        ))}
      </select>
      <p className={cn('mt-2 truncate text-ink', sampleClass)} style={{ fontFamily: `"${family}"` }}>
        {sample}
      </p>
    </div>
  )
}

function ColorField({ label, value, changed, onChange, onReset }: { label: string; value: string; changed: boolean; onChange: (v: string) => void; onReset: () => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  const id = `color-${label.toLowerCase()}`
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[0.95rem] font-medium text-ink-soft">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="size-11 shrink-0 cursor-pointer rounded-md border border-line bg-transparent p-0.5" />
        <input
          aria-label={`${label} hex code`}
          value={text}
          maxLength={7}
          onChange={(e) => {
            setText(e.target.value)
            const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
            if (isHex(v)) onChange(v.toUpperCase())
          }}
          className="input-base min-h-11 w-full py-2 font-mono text-sm uppercase"
        />
      </div>
      {changed && (
        <button type="button" onClick={onReset} className="mt-1 text-xs text-gold underline-offset-4 hover:underline">
          Use template colour
        </button>
      )}
    </div>
  )
}

function HeroThumb({ layout }: { layout: HeroLayout }) {
  const photo = 'bg-[linear-gradient(135deg,#8d7a66,#3d342c)]'
  return (
    <span aria-hidden="true" className="mt-0.5 block h-10 w-14 shrink-0 overflow-hidden rounded border border-line bg-ivory">
      {layout === 'center' && (
        <span className={cn('flex size-full items-center justify-center', photo)}>
          <span className="h-1 w-7 rounded bg-white/80" />
        </span>
      )}
      {layout === 'left' && (
        <span className={cn('flex size-full items-end p-1.5', photo)}>
          <span className="h-1 w-6 rounded bg-white/80" />
        </span>
      )}
      {layout === 'split' && (
        <span className="grid size-full grid-cols-2">
          <span className="flex items-center justify-center">
            <span className="h-1 w-4 rounded bg-ink/60" />
          </span>
          <span className={photo} />
        </span>
      )}
      {layout === 'framed' && (
        <span className="flex size-full flex-col items-center justify-center gap-0.5">
          <span className={cn('h-5 w-4 rounded-t-full', photo)} />
          <span className="h-0.5 w-5 rounded bg-ink/60" />
        </span>
      )}
    </span>
  )
}

/**
 * Page background: off (default), the front-page photo, or an uploaded photo,
 * staying still behind the home page while it scrolls. A wash of the page
 * colour keeps text readable.
 */
function PageBackgroundField({
  values,
  heroImageUrl,
  onChange,
}: {
  values: ThemeSettings
  heroImageUrl: string
  onChange: (patch: Partial<Pick<ThemeSettings, 'bgMode' | 'bgImage' | 'bgWash'>>) => void
}) {
  const toast = useToast()
  const [uploading, setUploading] = useState(false)
  const mode = values.bgMode ?? 'none'
  const wash = clampWash(values.bgWash)

  const upload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadWeddingAsset(file, 'background')
      onChange({ bgMode: 'upload', bgImage: url, bgWash: wash })
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <fieldset className="mt-6">
      <legend className="mb-1 text-[0.95rem] font-medium text-ink-soft">Page background</legend>
      <p className="mb-3 text-xs text-muted">A photo that stays still behind the home page while guests scroll. A calm photo works best — soft clouds, flowers, a nursery.</p>
      <div role="radiogroup" aria-label="Page background" className="grid gap-2 sm:grid-cols-3">
        {(
          [
            ['none', 'None', 'The usual page colour.'],
            ['hero', 'Front-page photo', heroImageUrl ? 'The photo at the top of the website.' : 'Add a front-page photo in Website Settings first.'],
            ['upload', 'Upload a photo', 'A separate, calm background photo.'],
          ] as const
        ).map(([v, title, hint]) => {
          const active = mode === v
          const disabled = v === 'hero' && !heroImageUrl
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => {
                if (v === 'none') onChange({ bgMode: undefined, bgImage: undefined, bgWash: undefined })
                else if (v === 'hero') onChange({ bgMode: 'hero', bgImage: undefined, bgWash: wash })
                else if (values.bgImage) onChange({ bgMode: 'upload', bgWash: wash })
                else document.getElementById('page-bg-file')?.click()
              }}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50',
                active ? 'border-ink bg-ink/[0.03]' : 'border-line hover:border-champagne',
              )}
            >
              <span className="block font-medium text-ink">{title}</span>
              <span className="block text-xs text-muted">{hint}</span>
            </button>
          )
        })}
      </div>
      <input id="page-bg-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
      {mode === 'upload' && (
        <div className="mt-3 flex items-center gap-3">
          {values.bgImage && <img src={values.bgImage} alt="" className="size-16 rounded-lg border border-line object-cover" />}
          <Button type="button" size="sm" variant="outline" loading={uploading} loadingText="Uploading…" onClick={() => document.getElementById('page-bg-file')?.click()}>
            {values.bgImage ? 'Change photo' : 'Choose a photo'}
          </Button>
        </div>
      )}
      {uploading && mode !== 'upload' && <p className="mt-2 text-xs text-muted">Uploading…</p>}
      {mode !== 'none' && (
        <label className="mt-4 block text-sm text-ink-soft">
          <span className="flex items-center justify-between">
            <span>Soften the photo</span>
            <span className="tabular-nums text-muted">{wash}%</span>
          </span>
          <input
            type="range"
            min={30}
            max={90}
            step={5}
            value={wash}
            onChange={(e) => onChange({ bgWash: Number(e.target.value) })}
            className="mt-2 w-full accent-ink"
            aria-label="Soften the photo"
          />
          <span className="mt-1 block text-xs text-muted">Higher keeps text easier to read. The preview shows the result.</span>
        </label>
      )}
    </fieldset>
  )
}
