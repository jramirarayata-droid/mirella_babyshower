import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import QRCode from 'qrcode'
import { Armchair, Bold, CheckCircle2, FileText, Heart, Mail, PenLine, Plus, Printer, RotateCcw, Shirt, Tent, Trash2, TriangleAlert, Wallet } from 'lucide-react'
import { useAdminData } from '../hooks/useAdminData'
import { useKept } from '../hooks/useKept'
import { invitationPosition } from '../utils/positions'
import { useToast } from '../hooks/useToast'
import { useWeddingSettings } from '../hooks/useWeddingSettings'
import { useMonogram } from '../hooks/useMonogram'
import { DEFAULT_PRINTABLE_PREFS, usePrintablePrefs, type PrintablePrefs, type SaveState } from '../hooks/usePrintablePrefs'
import { getGiftSettings } from '../services/giftService'
import { markInvitationsPrinted, updateInvitationAddressedAs, updateInvitationPosition } from '../services/adminService'
import { ADDRESS_TITLES, addressSuggestions, withTitle } from '../utils/addressing'
import { isRsvpOpen } from '../services/settingsService'
import type { InvitationWithRSVP, PositionMode } from '../types/rsvp'
import { SIDE_LABEL, bySide, type SideFilter } from '../utils/headcount'
import { FilterTabs } from '../components/admin/FilterTabs'
import { toFriendlyMessage } from '../utils/errors'
import { arrivalText, formatDateTime, formatDeadlineDate, formatWeddingDate, babyMonogram } from '../utils/formatting'
import {
  CARD_SIZES,
  ENV_FLAT,
  SHEETS,
  PAPERS,
  calibrationHtml,
  cropMarksSvg,
  envelopeSvg,
  attireCardHtml,
  attireOneCardHtml,
  avoidItems,
  attirePages,
  thankYouCardHtml,
  invitationBackHtml,
  invitationCardHtml,
  placeBack,
  unmarked,
  layoutRow,
  orientationMarkHtml,
  type CardSize,
  type Paper,
  ALL_DETAILS,
  ENVELOPE_ROOM,
  applyEnvelopeFit,
  type EnvelopeFit,
  type PaperMeasured,
  type PrintTheme,
} from '../utils/printables'
import { siteLinks } from '../utils/share'
import { measureCardFit, type CardFit } from '../utils/cardFit'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import { cn } from '../components/ui/cn'
import { PageHeader } from '../components/admin/PageHeader'
import { STYLES, resolveTheme, type StyleId } from '../theme/themes'
import { Card3D, Envelope3D } from '../components/printables/Preview3D'
import { MarkedTextEditor } from '../components/printables/MarkedTextEditor'
import { GuestSearch, OurDetailsSwitches, PaperMeasuredProvider, Ribbon, RibbonGroup, RibbonPane, RibbonProvider, Sheets, TipsFold, PrintBar, matches, printSummary } from '../components/printables/PrintShared'
import { DuplexPanel, NameCardsTab, TableNamesTab } from './printables/TablePrintables'
import { alignmentSheets } from '../utils/standPrintables'
import { LeafletsTab } from './printables/LeafletsTab'
import { readTheme } from '../utils/printTheme'
import { PAPER_PRESETS, forPaper, normalHex, type PaperFit, type PrintOn } from '../utils/paperColour'
import { listVisibleOutfits } from '../services/outfitService'
import type { OutfitImage } from '../types/wedding'

type Tab = 'invitations' | 'envelope' | 'attire' | 'thanks' | 'names' | 'tables' | 'leaflets'

/** Same-size stand-in for a personal QR while measuring or before the real one is ready. */
/** Shown in the 3D preview before any guest is ticked. */
const SAMPLE_GUEST = { id: 'sample', inviteeName: 'Your Guest’s Name', positionMode: 'custom', positionLabel: 'Ninang', guests: [] } as unknown as InvitationWithRSVP
const QR_PLACEHOLDER = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="100%" height="100%"><rect width="10" height="10" fill="none"/></svg>'

const chunk = <T,>(list: T[], n: number) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n))

const PRINTABLE_TYPES = [
  { v: 'invitations', l: 'Paper invitations', i: Mail },
  { v: 'envelope', l: 'Gift envelope', i: Wallet },
  { v: 'attire', l: 'What to wear', i: Shirt },
  { v: 'thanks', l: 'Thank-you card', i: Heart },
  { v: 'names', l: 'Name cards', i: Tent },
  { v: 'tables', l: 'Table names', i: Armchair },
  { v: 'leaflets', l: 'Leaflets', i: FileText },
] as const

export default function AdminPrintables() {
  const [tab, setTab] = useState<Tab>('invitations')
  const { prefs, update, reset, state } = usePrintablePrefs()
  const paper = prefs.paper
  const { settings } = useWeddingSettings()
  // Printables follow the website's design style; another can be tried here without changing the website.
  const savedStyle = resolveTheme(settings?.theme).style
  const design = prefs.design ?? savedStyle
  const sheet = SHEETS[paper]
  const [portraitPage, setPortraitPage] = useState(false)
  const paperFit = useMemo(() => forPaper({ ...readTheme(), style: design, frame: prefs.cardBorder !== false }, prefs.printOn, prefs.paperColour), [settings?.theme, design, prefs.printOn, prefs.paperColour, prefs.cardBorder])

  useEffect(() => {
    document.title = 'Printables · Baby shower admin'
  }, [])

  // The browser's print dialog uses this exact page size, with no margins.
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = portraitPage ? `@page { size: ${sheet.h}mm ${sheet.w}mm; margin: 0; }` : `@page { size: ${sheet.w}mm ${sheet.h}mm; margin: 0; }`
    document.head.appendChild(el)
    return () => el.remove()
  }, [sheet.w, sheet.h, portraitPage])

  // Table names on an upright (portrait) page: the print dialog gets the page turned too.
  useEffect(() => {
    if (tab !== 'tables') setPortraitPage(false)
  }, [tab])
  const usesCardSize = tab === 'invitations' || tab === 'attire' || tab === 'thanks'
  const envFit = applyEnvelopeFit({ ...DEFAULT_PRINTABLE_PREFS.envFit, ...(prefs.envFit ?? {}) })
  const props = { paper, design, prefs, update }
  const tabView =
    state === 'loading' ? (
        <p className="py-10 text-center text-sm text-muted">Loading your saved setup…</p>
      ) : tab === 'invitations' ? (
        <InvitationsTab {...props} />
      ) : tab === 'attire' ? (
        <AttireTab {...props} />
      ) : tab === 'names' ? (
        <NameCardsTab {...props} />
      ) : tab === 'tables' ? (
        <TableNamesTab {...props} onPortrait={setPortraitPage} />
      ) : tab === 'leaflets' ? (
        <LeafletsTab {...props} />
      ) : tab === 'thanks' ? (
        <ThankYouTab {...props} />
      ) : (
        <EnvelopeTab {...props} />
      )

  return (
    <RibbonProvider>
      <PaperMeasuredProvider value={prefs.paperMeasured ?? {}}>
      <div className="print:hidden">
        <PageHeader title="Printables" description="Pick what to print, adjust the settings, check the preview and print — all in your website’s design." />
      </div>
      <Ribbon
        main={tabView}
        head={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className="flex w-full items-center gap-3 text-sm text-ink-soft sm:hidden">
              Printable
              <select aria-label="Printable" className="input-base min-h-11 flex-1 py-2" value={tab} onChange={(e) => setTab(e.target.value as typeof tab)}>
                {PRINTABLE_TYPES.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.l}
                  </option>
                ))}
              </select>
            </label>
            <div role="tablist" aria-label="Printable type" className="hidden max-w-full flex-wrap gap-1 rounded-lg bg-cream p-1 sm:flex">
              {PRINTABLE_TYPES.map((t) => (
                <button
                  key={t.v}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.v}
                  onClick={() => setTab(t.v)}
                  className={cn('inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition', tab === t.v ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
                >
                  <t.i aria-hidden="true" className="size-4" /> {t.l}
                </button>
              ))}
            </div>
            <SavedNote state={state} onReset={reset} />
          </div>
        }
      >
        <RibbonPane pane="page">
          <RibbonGroup label="Paper & style">
            <label className="flex items-center gap-3 text-sm text-ink-soft">
              <span className="w-14 shrink-0">Paper</span>
              <select aria-label="Paper" className="input-base min-h-10 w-full min-w-0 flex-1 py-1.5" value={paper} onChange={(e) => update({ paper: e.target.value as Paper })}>
                {PAPERS.map((p) => (
                  <option key={p} value={p}>
                    {SHEETS[p].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 text-sm text-ink-soft">
              <span className="w-14 shrink-0">Design</span>
              <select aria-label="Design" className="input-base min-h-10 w-full min-w-0 flex-1 py-1.5" value={design} onChange={(e) => update({ design: e.target.value === savedStyle ? null : (e.target.value as StyleId) })}>
                {STYLES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                    {st.id === savedStyle ? ' (your website)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <PaperMeasureFields
              paper={paper}
              measured={prefs.paperMeasured?.[paper]}
              onChange={(m) => {
                const n = { ...(prefs.paperMeasured ?? {}) }
                if (m) n[paper] = m
                else delete n[paper]
                update({ paperMeasured: n })
              }}
            />
          </RibbonGroup>
          {usesCardSize && (
            <RibbonGroup label="Card size">
              <label className="block text-sm text-ink-soft">
                <span className="sr-only">Card size</span>
                <select aria-label="Card size" className="input-base min-h-10 w-full py-1.5" value={prefs.size} onChange={(e) => update({ size: e.target.value as CardSize })}>
                  {(Object.keys(CARD_SIZES) as CardSize[]).map((k) => (
                    <option key={k} value={k}>
                      {CARD_SIZES[k].label} — {CARD_SIZES[k].perSheet[paper]} per sheet
                    </option>
                  ))}
                </select>
              </label>
              {prefs.size === 'fit' ? (
                <EnvelopeFitFields value={{ ...DEFAULT_PRINTABLE_PREFS.envFit, ...(prefs.envFit ?? {}) }} onChange={(v) => update({ envFit: v })} result={envFit} />
              ) : (
                <p className="text-xs text-muted">Cards going in a 5 × 7 in envelope? Choose “Fits my envelope” — it leaves room for the stack.</p>
              )}
            </RibbonGroup>
          )}
          <RibbonGroup label="Border">
            <div role="radiogroup" aria-label="Border on the cards" className="flex gap-1 rounded-lg bg-cream p-1">
              {(
                [
                  { v: true, l: 'Show' },
                  { v: false, l: 'Hide' },
                ] as const
              ).map((o) => (
                <button
                  key={o.l}
                  type="button"
                  role="radio"
                  aria-checked={(prefs.cardBorder !== false) === o.v}
                  onClick={() => update({ cardBorder: o.v })}
                  className={cn('rounded-md px-3 py-1 text-sm transition', (prefs.cardBorder !== false) === o.v ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">The design’s frame around each card, on every printable. Corner marks for cutting stay.</p>
          </RibbonGroup>
          <RibbonGroup label="Print on">
            <div role="radiogroup" aria-label="Print on" className="flex gap-1 rounded-lg bg-cream p-1">
              {(
                [
                  { v: 'designed', l: 'As designed' },
                  { v: 'coloured', l: 'Coloured paper' },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  role="radio"
                  aria-checked={prefs.printOn === o.v}
                  onClick={() => update({ printOn: o.v as PrintOn })}
                  className={cn('rounded-md px-3 py-1 text-sm transition', prefs.printOn === o.v ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
                >
                  {o.l}
                </button>
              ))}
            </div>
            {state !== 'loading' && prefs.printOn === 'coloured' && (
              <PaperPicker colour={prefs.paperColour} motif={settings?.motifColors ?? []} fit={paperFit} onChange={(hex) => update({ paperColour: hex })} />
            )}
          </RibbonGroup>
        </RibbonPane>
      </Ribbon>
      </PaperMeasuredProvider>
    </RibbonProvider>
  )
}

/** "Fits my envelope": the envelope's inside size and what goes in it. */
/** cm with one decimal, two when needed (29.75). */
const cm = (mm: number) => (Math.round(mm) / 10).toFixed(2).replace(/0$/, '')

/** "My paper": the sheet as measured with a ruler, so the design is centred on it. */
function PaperMeasureFields({ paper, measured, onChange }: { paper: Paper; measured: PaperMeasured | undefined; onChange: (m: PaperMeasured | null) => void }) {
  const s = SHEETS[paper]
  const nominal = { w: s.h, h: s.w }
  const cur = measured ?? nominal
  const [draft, setDraft] = useState({ w: cm(cur.w), h: cm(cur.h) })
  const [bad, setBad] = useState(false)
  useEffect(() => {
    setDraft({ w: cm(cur.w), h: cm(cur.h) })
    setBad(false)
  }, [paper, cur.w, cur.h])
  const commit = () => {
    const w = Math.round(Number(draft.w.replace(',', '.')) * 10)
    const h = Math.round(Number(draft.h.replace(',', '.')) * 10)
    if (!w || !h || Math.abs(w - nominal.w) > 10 || Math.abs(h - nominal.h) > 10) {
      setBad(true)
      return
    }
    setBad(false)
    if (w === cur.w && h === cur.h) return // nothing changed — don't save again
    onChange(w === nominal.w && h === nominal.h ? null : { w, h })
  }
  const dw = cur.w - nominal.w
  const dh = cur.h - nominal.h
  const off = (d: number, side: string) => `${Math.abs(d).toFixed(1)} mm ${d > 0 ? 'longer' : 'shorter'} on the ${side} side`
  const notes = [dw ? off(dw, 'short') : '', dh ? off(dh, 'long') : ''].filter(Boolean)
  const box = (k: 'w' | 'h', label: string) => (
    <input
      type="text"
      inputMode="decimal"
      aria-label={`${label} (cm)`}
      className="input-base min-h-8 w-16 px-2 py-0.5 text-right"
      value={draft[k]}
      onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  )
  return (
    <div role="group" aria-label="My paper" className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-sm text-ink-soft">
        <span className="mr-auto" title={`${s.name} is ${cm(nominal.w)} × ${cm(nominal.h)} cm. Paper is often a little off — measure a sheet with a ruler.`}>
          My paper measures
        </span>
        {box('w', 'Measured width')}
        <span aria-hidden="true">×</span>
        {box('h', 'Measured height')}
        cm
      </div>
      {bad && (
        <p role="alert" className="text-xs text-rose">
          That’s more than 1 cm off {s.name} — check the measurement.
        </p>
      )}
      {notes.length > 0 ? (
        <p data-paper-note className="text-xs text-ink-soft">
          Your sheet is {notes.join(' and ')} — the design is centred on it. Backs still off? Use the line-up test under <strong>Print</strong>.{' '}
          <button type="button" onClick={() => onChange(null)} className="text-gold underline underline-offset-2">
            Exact {s.name}
          </button>
        </p>
      ) : (
        <p className="text-xs text-muted">
          {s.name} is {cm(nominal.w)} × {cm(nominal.h)} cm — if yours measures differently, type it here.
        </p>
      )}
    </div>
  )
}

/** The back's line-up offset (shared by every printable) and the line-up test sheets. */
function useLineUp(paper: Paper, theme: PrintTheme, prefs: PrintablePrefs, rotate = false) {
  const [testing, setTesting] = useState(false)
  const back = (html: string) => placeBack(html, { dx: prefs.duplexDx, dy: prefs.duplexDy, rotate })
  const test = (side: 'front' | 'back' | 'both') => {
    const [f, b] = alignmentSheets(paper, theme, { mirror: true, dx: 0, dy: 0 })
    return side === 'front' ? [f] : side === 'back' ? [back(b)] : [f, back(b)]
  }
  return { testing, setTesting, back, test }
}

function EnvelopeFitFields({ value, onChange, result }: { value: EnvelopeFit; onChange: (v: EnvelopeFit) => void; result: { w: number; h: number; stack: number } }) {
  const n = (v: string, min: number, max: number, step = 0.1) => Math.max(min, Math.min(max, Math.round((Number(v) || 0) / step) * step))
  const field = (label: string, v: number, set: (x: string) => void, step: number, unit: string) => (
    <label className="flex items-center justify-between gap-2 text-xs text-ink-soft">
      {label}
      <span className="flex items-center gap-1">
        <input type="number" step={step} value={v} onChange={(e) => set(e.target.value)} className="input-base min-h-8 w-20 py-0.5 text-sm" />
        <span className="w-6 text-muted">{unit}</span>
      </span>
    </label>
  )
  return (
    <div className="space-y-1.5" role="group" aria-label="Your envelope">
      {field('Envelope inside — width', round1(value.w / 25.4), (x) => onChange({ ...value, w: n(x, 3, 12, 0.05) * 25.4 }), 0.05, 'in')}
      {field('Envelope inside — height', round1(value.h / 25.4), (x) => onChange({ ...value, h: n(x, 4, 14, 0.05) * 25.4 }), 0.05, 'in')}
      {field('Cards in each envelope', value.cards, (x) => onChange({ ...value, cards: n(x, 1, 8, 1) }), 1, '')}
      {field('Each card’s thickness', value.thick, (x) => onChange({ ...value, thick: n(x, 0.1, 1, 0.05) }), 0.05, 'mm')}
      <p className="text-xs text-muted">
        Cards print at <b className="text-ink">{(result.w / 10).toFixed(1)} × {(result.h / 10).toFixed(1)} cm</b> — {ENVELOPE_ROOM} mm of room plus the stack ({result.stack} mm).
      </p>
    </div>
  )
}
const round1 = (v: number) => Math.round(v * 100) / 100

/** "Your setup is saved" status, with a way back to the defaults. */
function SavedNote({ state, onReset }: { state: SaveState; onReset: () => void }) {
  const [asking, setAsking] = useState(false)
  if (state === 'loading') return null
  const text = state === 'saving' ? 'Saving your setup…' : state === 'saved' ? 'Setup saved — it’ll be here next time' : state === 'error' ? 'Couldn’t save your setup' : 'Your choices are saved as you go'
  return (
    <div className="flex items-center gap-2 text-xs sm:ml-auto">
      <span className={cn('inline-flex items-center gap-1', state === 'error' ? 'text-rose' : 'text-muted')}>
        {state === 'saved' && <CheckCircle2 aria-hidden="true" className="size-3.5 text-sage" />}
        <span aria-live="polite">{text}</span>
      </span>
      {state === 'saved' && (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          <RotateCcw aria-hidden="true" className="size-3" /> Reset to defaults
        </button>
      )}
      <ConfirmDialog
        destructive
        open={asking}
        title="Reset Printables?"
        message="Card size, design, QR placement, “Good to know” picks, bold titles and the other options go back to the defaults. Your guests and invitations aren’t affected."
        confirmLabel="Reset"
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false)
          onReset()
        }}
      />
    </div>
  )
}

/** A colour input needs #rrggbb. */
const colourInputValue = (hex: string) => (normalHex(hex) ?? '#EADBC0').toLowerCase()

/**
 * Coloured paper: which colour you're printing on. Nothing is printed for the
 * background, so this is only for the preview (and to keep the gold readable).
 */
function PaperPicker({ colour, motif, fit, onChange }: { colour: string; motif: { name: string; hex: string }[]; fit: PaperFit; onChange: (hex: string) => void }) {
  const current = normalHex(colour) ?? colour
  const fromMotif = motif
    .map((m) => ({ name: m.name.trim() || 'Motif colour', hex: normalHex(m.hex) ?? '' }))
    .filter((m, i, all) => m.hex && !PAPER_PRESETS.some((p) => p.hex === m.hex) && all.findIndex((x) => x.hex === m.hex) === i)
  const custom = ![...PAPER_PRESETS, ...fromMotif].some((p) => p.hex === current)
  const chip = (p: { name: string; hex: string }, label: string) => (
    <button
      key={label}
      type="button"
      role="radio"
      aria-checked={p.hex === current}
      aria-label={label}
      onClick={() => onChange(p.hex)}
      className={cn(
        'flex min-h-10 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition',
        p.hex === current ? 'border-ink bg-paper text-ink shadow-soft' : 'border-line text-ink-soft hover:border-ink-soft hover:text-ink',
      )}
    >
      <span aria-hidden="true" className="size-7 rounded-full ring-1 ring-inset ring-black/10" style={{ background: p.hex }} />
      {p.name}
    </button>
  )
  return (
    <div role="group" aria-label="Coloured paper" className="w-[34rem] max-w-[85vw]">
      <div role="radiogroup" aria-label="Paper colour" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium text-ink">Your paper colour</span>
        {PAPER_PRESETS.map((p) => chip(p, p.name))}
        {fromMotif.length > 0 && <span className="ml-2 mr-1 text-xs uppercase tracking-[0.2em] text-muted">Your motif</span>}
        {fromMotif.map((p) => chip(p, `${p.name} (your motif)`))}
        <label
          className={cn(
            'flex min-h-10 cursor-pointer items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition',
            custom ? 'border-ink bg-paper text-ink shadow-soft' : 'border-line text-ink-soft hover:border-ink-soft hover:text-ink',
          )}
        >
          <span className="relative size-7 overflow-hidden rounded-full ring-1 ring-inset ring-black/10" style={{ background: custom ? current : 'conic-gradient(#f2dad3, #eadbc0, #c9a47e, #d8e0d0, #dfe6ee, #f2dad3)' }}>
            <input type="color" aria-label="Custom paper colour" value={colourInputValue(current)} onChange={(e) => onChange(normalHex(e.target.value) ?? e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
          </span>
          Other…
        </label>
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        Nothing is printed for the background — your paper’s colour shows through, so only the words, lines, monogram, QR codes and photos use ink. The colour here is just for
        the preview.
      </p>
      {fit.tooDark ? (
        <p role="alert" className="mt-2 flex items-start gap-2 text-sm text-rose">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          This paper is quite dark. Home printers can’t print white, so the words won’t stand out and the QR codes may not scan — a lighter paper works best.
        </p>
      ) : fit.deepened ? (
        <p className="mt-2 text-sm text-muted">The gold prints a shade deeper so it still stands out on this paper.</p>
      ) : null}
    </div>
  )
}

export type PrefsProps = { prefs: PrintablePrefs; update: (patch: Partial<PrintablePrefs>) => void }

type View = 'sheets' | '3d'

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div role="radiogroup" aria-label="Preview" className="mb-3 inline-flex gap-1 rounded-lg bg-cream p-1 print:hidden">
      {(
        [
          { v: 'sheets', l: 'Print sheets' },
          { v: '3d', l: '3D preview' },
        ] as const
      ).map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={view === o.v}
          onClick={() => onChange(o.v)}
          className={cn('rounded-md px-3 py-1.5 text-sm transition', view === o.v ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}

/** Measures the available width (for sizing the 3D preview). */
function useWidth() {
  const [width, setWidth] = useState(640)
  const ref = (el: HTMLElement | null) => {
    if (el && Math.abs(el.clientWidth - width) > 4) setWidth(el.clientWidth)
  }
  return { width, ref }
}

// ---------------------------------------------------------------- invitations

/** Sent from the Invitations page: which invitations to pre-select and which side to show. */
export interface PrintablesHandoff {
  select?: string[]
  side?: SideFilter
}

function InvitationsTab({ paper, design, prefs, update }: { paper: Paper; design: StyleId } & PrefsProps) {
  const toast = useToast()
  const { data, reload } = useAdminData()
  const { settings } = useWeddingSettings()
  const mono = useMonogram()
  const monogramArt = mono ? { src: mono.src, aspect: mono.aspect } : null
  const location = useLocation()
  const [handoff] = useState<PrintablesHandoff>(() => (location.state as PrintablesHandoff | null) ?? {})
  const size = prefs.size
  const [showAll, setShowAll] = useKept('inv-show-all', false)
  const [side, setSide] = useKept<SideFilter>('inv-side', 'all', handoff.side)
  const [selected, setSelected] = useKept<Set<string>>('inv-selected', new Set(), handoff.select ? new Set(handoff.select) : undefined)
  const [cardOpen, setCardOpen] = useState<string | null>(null)
  // Position edits made here show in the preview straight away, while they save.
  const [posEdits, setPosEdits] = useState<Record<string, { mode: PositionMode; label: string }>>({})
  // "Addressed as" edits show in the preview straight away, while they save.
  const [addrEdits, setAddrEdits] = useState<Record<string, string>>({})
  const [qr, setQr] = useState<Record<string, string>>({})
  const [askMark, setAskMark] = useState(false)
  const [view, setView] = useState<View>('sheets')
  const printSide = prefs.printSide
  const setPrintSide = (v: PrintablePrefs['printSide']) => update({ printSide: v })
  const [sheetNo, setSheetNo] = useState(0) // 0 = all sheets
  const rotateBacks = prefs.rotateBacks
  const setRotateBacks = (v: boolean) => update({ rotateBacks: v })
  const showPositions = prefs.showPositions
  const { showCeremony, showRespondBy, showWithNames } = prefs
  const sparse = !showCeremony || !showRespondBy || !showWithNames
  const setShowPositions = (v: boolean) => update({ showPositions: v })
  const qrPlace = prefs.qrPlace
  const ours = { ...ALL_DETAILS, ...(prefs.ours?.invitations ?? {}) }
  const setQrPlace = (v: PrintablePrefs['qrPlace']) => update({ qrPlace: v })
  // "Good to know" on the back: Website Settings sections (their wording can be changed for print
  // only) plus your own print-only sections. Default: the first three from the website.
  const gtkEdits = prefs.gtkEdits ?? {}
  const gtkExtra = prefs.gtkExtra ?? []
  const infoSections = useMemo(
    () => [
      ...(settings?.sections ?? [])
        .filter((x) => x.visible && (x.title.trim() || x.body.trim()))
        .map((x) => ({ id: x.id, title: gtkEdits[x.id]?.title ?? x.title, body: gtkEdits[x.id]?.body ?? x.body, site: { title: x.title, body: x.body }, edited: Boolean(gtkEdits[x.id]), own: false })),
      ...gtkExtra.map((x) => ({ ...x, site: null, edited: false, own: true })),
    ],
    [settings, gtkEdits, gtkExtra],
  )
  const [editing, setEditing] = useState<{ id: string; title: string; body: string; own: boolean; site: { title: string; body: string } | null } | null>(null)
  const [q, setQ] = useState('')
  const backIds = new Set(prefs.backIds ?? infoSections.filter((x) => !x.own).slice(0, 3).map((x) => x.id))
  const setBackPick = (n: Set<string>) => update({ backIds: [...n] })
  const boldIds = new Set(prefs.boldIds)
  const toggleBold = (id: string) => {
    const n = new Set(boldIds)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    update({ boldIds: [...n] })
  }
  const backSections = infoSections.filter((x) => backIds.has(x.id)).map((x) => ({ title: x.title, body: x.body, bold: boldIds.has(x.id), marked: x.edited || x.own }))
  // The venue line on the front: the website's, or worded for print only (with bold / italic / gold).
  const frontText = prefs.frontText ?? {}
  const siteFront = {
    ceremony: [settings?.churchName, settings?.ceremonyTime].filter(Boolean).join(' · '),
    reception: '',
  }
  const frontLine = (k: 'ceremony' | 'reception') => frontText[k] ?? siteFront[k]
  const [frontEditing, setFrontEditing] = useState<{ key: 'ceremony' | 'reception'; text: string } | null>(null)
  const frontSave = (key: 'ceremony' | 'reception', text: string | null) => {
    const n = { ...frontText }
    if (text === null) delete n[key]
    else n[key] = text
    update({ frontText: n })
    setFrontEditing(null)
  }
  const measureHost = useRef<HTMLDivElement>(null)
  const [fits, setFits] = useState<Record<string, CardFit>>({})
  const [backFit, setBackFit] = useState<CardFit>({ fit: 1, overflow: false })
  // Positions are typed per invitation (there is no entourage to take them from).
  const autoPositions = useMemo(() => new Map<string, string>(), [])
  const effective = (inv: InvitationWithRSVP): InvitationWithRSVP => {
    const e = posEdits[inv.id]
    const a = addrEdits[inv.id]
    const withPos = e ? { ...inv, positionMode: e.mode, positionLabel: e.label } : inv
    return a !== undefined ? { ...withPos, addressedAs: a } : withPos
  }
  const addressedOf = (inv: InvitationWithRSVP) => effective(inv).addressedAs?.trim() ?? ''
  const saveAddressed = async (inv: InvitationWithRSVP, text: string) => {
    const clean = text.replace(/\s+/g, ' ').trim()
    setAddrEdits((p) => ({ ...p, [inv.id]: clean }))
    try {
      await updateInvitationAddressedAs(inv.id, clean)
      void reload()
      toast.success(clean ? `Saved: “${clean}”` : `Back to “${inv.inviteeName}”`)
    } catch (e) {
      toast.error(toFriendlyMessage(e))
      setAddrEdits((p) => {
        const n = { ...p }
        delete n[inv.id]
        return n
      })
    }
  }
  const positionOf = (inv: InvitationWithRSVP) => (showPositions ? invitationPosition(effective(inv), autoPositions) : '')
  const savePosition = async (inv: InvitationWithRSVP, mode: PositionMode, label: string) => {
    setPosEdits((p) => ({ ...p, [inv.id]: { mode, label } }))
    try {
      await updateInvitationPosition(inv.id, mode, label)
      void reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
      setPosEdits((p) => {
        const n = { ...p }
        delete n[inv.id]
        return n
      })
    }
  }
  const withNamesOf = (inv: InvitationWithRSVP) =>
    inv.guests
      .filter((g) => g.addedBy === 'admin')
      .map((g) => {
        const pos = showPositions ? autoPositions.get(`${inv.id}:${g.id}`) : undefined
        return pos ? `${g.guestName} (${pos})` : g.guestName
      })
  const box = useWidth()
  const [marking, setMarking] = useState(false)
  const paperFit = useMemo(() => forPaper({ ...readTheme(), style: design, frame: prefs.cardBorder !== false }, prefs.printOn, prefs.paperColour), [settings?.theme, design, prefs.printOn, prefs.paperColour, prefs.cardBorder])
  const theme = paperFit.theme
  const links = useMemo(() => siteLinks(), [])

  // Arriving with invitations that already responded: show everyone so they're visible.
  useEffect(() => {
    if (!data || !handoff.select?.length) return
    if (data.invitations.some((i) => handoff.select!.includes(i.id) && i.status !== 'pending')) setShowAll(true)
  }, [data, handoff])

  const active = useMemo(() => (data?.invitations ?? []).filter((i) => i.isActive && (showAll || i.status === 'pending')), [data, showAll])
  const list = useMemo(() => bySide(active, side).sort((a, b) => a.inviteeName.localeCompare(b.inviteeName)), [active, side])
  const chosen = list.filter((i) => selected.has(i.id))
  const shown = q.trim() ? list.filter((i) => matches(q, i.inviteeName, i.addressedAs, i.guests.map((g) => g.guestName).join(' '), i.tableNumber, i.side, i.invitationCode)) : list
  const linkFor = (i: InvitationWithRSVP) => `${links.rsvp}?invite=${encodeURIComponent(i.invitationCode)}`

  useEffect(() => {
    let active = true
    const missing = chosen.filter((i) => !qr[i.id])
    if (!missing.length) return
    Promise.all(
      missing.map(async (i) => [i.id, await QRCode.toString(linkFor(i), { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff00' } })] as const),
    ).then((pairs) => active && setQr((q) => ({ ...q, ...Object.fromEntries(pairs) })))
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen.map((c) => c.id).join(',')])

  useEffect(() => {
    const after = () => chosen.length && setAskMark(true)
    window.addEventListener('afterprint', after)
    return () => window.removeEventListener('afterprint', after)
  }, [chosen.length])

  const card = CARD_SIZES[size]
  const perSheet = card.perSheet[paper]
  const s = SHEETS[paper]
  const respondBy = settings && settings.rsvpShowDeadline && settings.rsvpDeadline && isRsvpOpen(settings) ? formatDeadlineDate(settings.rsvpDeadline) : null
  const shortLink = links.home.replace(/^https?:\/\//, '').replace(/\/$/, '')
  // Nobody ticked yet: preview a sample card (never printed) so the page shows what it makes.
  const sample = chosen.length === 0
  const groups = chunk(sample ? [SAMPLE_GUEST] : chosen, perSheet)
  const qrOnBack = qrPlace === 'back'
  const frontFor = (inv: InvitationWithRSVP, fit = 1, sz: CardSize = size, qrSvg = qr[inv.id] ?? '') =>
    invitationCardHtml({
      guestName: addressedOf(inv) || inv.inviteeName,
      position: positionOf(inv),
      withNames: showWithNames && !addressedOf(inv) ? withNamesOf(inv) : [],
      coupleNames: settings?.coupleNames ?? '',
      babyName: settings?.babyName ?? 'Baby',
      arriving: settings ? arrivalText(settings) : '',
      dateText: settings ? formatWeddingDate(settings.weddingDate, 'full') : '',
      ceremony: showCeremony ? frontLine('ceremony') : '',
      reception: '',
      ceremonyMarked: frontText.ceremony !== undefined,
      respondBy: showRespondBy ? respondBy : null,
      sparse,
      qrSvg,
      shortLink,
      theme,
      size: sz,
      qrOnBack,
      fit,
    })
  const backFor = (inv: InvitationWithRSVP | null, fit = 1, sz: CardSize = size, qrSvg = inv ? qr[inv.id] ?? '' : '') =>
    invitationBackHtml({
      coupleNames: settings?.babyName ?? '',
      dateText: settings ? formatWeddingDate(settings.weddingDate) : '',
      monogram: settings ? babyMonogram(settings.babyName) : '',
      monogramArt,
      theme,
      size: sz,
      ...(qrOnBack ? { qrSvg: qrSvg || QR_PLACEHOLDER, respondBy: showRespondBy ? respondBy : null, shortLink, guestName: inv?.inviteeName } : {}),
      sections: backSections,
      show: ours,
      fit,
    })

  // Measure every listed card with the real fonts: shrink text a little when a card is very
  // full, and flag the ones that still don't fit inside the frame.
  const measureKey = JSON.stringify([list.map((i) => [i.id, positionOf(i), withNamesOf(i), addressedOf(i)]), design, qrPlace, backSections, ours, size, CARD_SIZES[size].w, settings?.theme, settings?.coupleNames, settings?.babyName, settings?.dueDate, settings?.dueText, settings?.dueVisible, respondBy, showCeremony, showRespondBy, showWithNames, frontText])
  useEffect(() => {
    const host = measureHost.current
    if (!host || !settings) return
    let cancelled = false
    const run = () => {
      if (cancelled) return
      const next: Record<string, CardFit> = {}
      for (const inv of list) next[inv.id] = measureCardFit((f) => frontFor(inv, f, '5x7', QR_PLACEHOLDER), host)
      setFits(next)
      setBackFit(measureCardFit((f) => backFor(list[0] ?? null, f, '5x7', QR_PLACEHOLDER), host))
    }
    void document.fonts.ready.then(run)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureKey])
  const fitOf = (inv: InvitationWithRSVP) => fits[inv.id] ?? { fit: 1, overflow: false }
  const overflowing = list.filter((i) => fitOf(i).overflow)
  const flag = (html: string, bad: boolean) =>
    bad ? `${html}<div class="screen-only" style="position:absolute;inset:0;outline:0.8mm solid #c0392b;outline-offset:-0.4mm;pointer-events:none"></div>` : html

  const lineUp = useLineUp(paper, theme, prefs, rotateBacks)
  const layouts = groups.map((group) => layoutRow(s.w, s.h, group.length === perSheet ? perSheet : group.length, card.w, card.h))
  const fronts = groups.map((group, gi) => {
    const pos = layouts[gi]
    const cards = group
      .map((inv, k) => `<div style="position:absolute;left:${pos[k].x}mm;top:${pos[k].y}mm">${flag(frontFor(inv, fitOf(inv).fit), fitOf(inv).overflow)}</div>`)
      .join('')
    return cards + cropMarksSvg(s.w, s.h, pos, theme.muted) + orientationMarkHtml('front', gi + 1, groups.length, theme) + calibrationHtml(theme)
  })
  // Backs are printed in mirrored order (the sheet is turned over left-to-right), so each
  // guest's back — with their own RSVP QR — lands exactly behind their front.
  const backs = groups.map((group, gi) => {
    const pos = layouts[gi]
    const n = group.length
    const inner =
      pos
        .map((p, k) => {
          const inv = group[n - 1 - k]
          return `<div style="position:absolute;left:${p.x}mm;top:${p.y}mm">${flag(backFor(inv, backFit.fit), backFit.overflow)}</div>`
        })
        .join('') +
      cropMarksSvg(s.w, s.h, pos, theme.muted) +
      orientationMarkHtml('back', gi + 1, groups.length, theme)
    return lineUp.back(inner)
  })
  const pick = <T,>(list: T[]) => (sheetNo > 0 ? list.slice(sheetNo - 1, sheetNo) : list)
  const sheets = lineUp.testing
    ? lineUp.test(printSide)
    : printSide === 'front'
      ? pick(fronts)
      : printSide === 'back'
        ? pick(backs)
        : pick(fronts.map((f, i) => [f, backs[i]])).flat()

  const toggle = (id: string) =>
    setSelected((cur) => {
      const n = new Set(cur)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const mark = async () => {
    setMarking(true)
    try {
      await markInvitationsPrinted(chosen.map((c) => c.id))
      toast.success(`Marked ${chosen.length} as printed.`)
      setAskMark(false)
      setSelected(new Set())
      await reload()
    } catch (e) {
      toast.error(toFriendlyMessage(e))
    } finally {
      setMarking(false)
    }
  }

  const gtkSave = (e: NonNullable<typeof editing>) => {
    if (e.own) update({ gtkExtra: gtkExtra.some((x) => x.id === e.id) ? gtkExtra.map((x) => (x.id === e.id ? { id: e.id, title: e.title, body: e.body } : x)) : [...gtkExtra, { id: e.id, title: e.title, body: e.body }] })
    else update({ gtkEdits: { ...gtkEdits, [e.id]: { title: e.title, body: e.body } } })
    setEditing(null)
  }
  const gtkReset = (id: string) => {
    const n = { ...gtkEdits }
    delete n[id]
    update({ gtkEdits: n })
    setEditing(null)
  }
  const gtkDelete = (id: string) => {
    update({ gtkExtra: gtkExtra.filter((x) => x.id !== id), backIds: [...backIds].filter((x) => x !== id) })
    setEditing(null)
  }

  return (
    <div className="min-w-0">
      <PrintBar
        summary={
          lineUp.testing
            ? printSummary(['Line-up test', `${sheets.length} ${sheets.length === 1 ? 'page' : 'pages'}`, SHEETS[paper].name])
            : chosen.length
              ? printSummary([`${chosen.length} ${chosen.length === 1 ? 'invitation' : 'invitations'}`, `${sheets.length} ${sheets.length === 1 ? 'page' : 'pages'}`, SHEETS[paper].name, CARD_SIZES[size].label])
              : 'No guests ticked yet — choose them in the list'
        }
        below={
                    askMark && chosen.length > 0 && (
                      <div className="mt-2 rounded-lg border border-gold/40 bg-champagne-light/30 p-3 text-sm">
                        <p className="text-ink">Did they print well? Mark {chosen.length} as printed so you don’t print them twice.</p>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" loading={marking} onClick={() => void mark()} icon={<CheckCircle2 aria-hidden="true" className="size-4" />}>
                            Mark as printed
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setAskMark(false)}>
                            Not now
                          </Button>
                        </div>
                      </div>
                    )
        }
      >
        <div role="radiogroup" aria-label="What to print" className="grid grid-cols-3 gap-1 rounded-lg bg-cream p-1">
          {(
            [
              { v: 'front', l: 'Fronts' },
              { v: 'back', l: 'Backs' },
              { v: 'both', l: 'Both sides' },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={printSide === o.v}
              onClick={() => setPrintSide(o.v)}
              className={cn('rounded-md px-2 py-1.5 text-sm transition', printSide === o.v ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
            >
              {o.l}
            </button>
          ))}
        </div>
        <Button className="sm:min-w-44" disabled={!chosen.length && !lineUp.testing} onClick={() => window.print()} icon={<Printer aria-hidden="true" className="size-4" />}>
          {lineUp.testing ? 'Print the line-up test' : printSide === 'front' ? 'Print fronts' : printSide === 'back' ? 'Print backs' : 'Print both sides'}
          {sheets.length > 1 ? ` (${sheets.length} pages)` : ''}
        </Button>
      </PrintBar>
      <div ref={measureHost} aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, visibility: 'hidden', pointerEvents: 'none' }} />

      <RibbonPane pane="content">
        <RibbonGroup label="RSVP QR" className="w-64">
          <div>
            
            <div role="radiogroup" aria-label="RSVP QR code" className="grid grid-cols-2 gap-1 rounded-lg bg-cream p-1">
              {(
                [
                  { v: 'back', l: 'On the back' },
                  { v: 'front', l: 'On the front' },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  role="radio"
                  aria-checked={qrPlace === o.v}
                  onClick={() => setQrPlace(o.v)}
                  className={cn('rounded-md px-2 py-1.5 text-sm transition', qrPlace === o.v ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">
              {qrOnBack
                  ? 'Recommended: the front stays clean and says “Please turn over to RSVP”. Remember to print the backs too.'
                  : 'Everything a guest needs is on the front, even if you only print fronts.'}
            </p>
          </div>
        </RibbonGroup>
        <RibbonGroup label="Front of the card" className="w-72">
          <fieldset className="space-y-2 text-sm text-ink-soft">
            <legend className="mb-2">
              On the front of the card
              <span className="block text-xs text-muted">Untick to leave a detail off; the rest moves to the middle so the card stays balanced.</span>
            </legend>
            {(
              [
                ['showCeremony', 'Venue'],
                ['showRespondBy', '“Please respond by” date'],
                ['showWithNames', 'Included guests (“and …”)'],
              ] as const
            ).map(([key, label]) => {
              const line = key === 'showCeremony' ? 'ceremony' : null
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <label className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {label}
                      {line && frontText[line] !== undefined && <Badge tone="gray">Edited</Badge>}
                    </span>
                    <input type="checkbox" checked={prefs[key]} onChange={(e) => update({ [key]: e.target.checked } as Partial<PrintablePrefs>)} className="size-5 shrink-0 accent-ink" />
                  </label>
                  {line && (
                    <button
                      type="button"
                      aria-label={`Edit for print: ${label}`}
                      title="Change the wording, or make words bold / italic / gold — for print only"
                      onClick={() => setFrontEditing({ key: line, text: frontLine(line) })}
                      className="grid size-7 shrink-0 place-items-center rounded-md border border-line text-muted transition hover:border-ink-soft hover:text-ink"
                    >
                      <PenLine aria-hidden="true" className="size-3.5" />
                    </button>
                  )}
                  {!line && <span aria-hidden="true" className="size-7 shrink-0" />}
                </div>
              )
            })}
          </fieldset>
          <label className="flex items-start justify-between gap-3 text-sm text-ink-soft">
            <span>
              Show positions under names
              <span className="block text-xs text-muted">E.g. “Ninang” or “Lola”. Set per invitation.</span>
            </span>
            <span className="flex shrink-0 items-start gap-1.5">
              <input type="checkbox" checked={showPositions} onChange={(e) => setShowPositions(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-ink" />
              <span aria-hidden="true" className="size-7" />
            </span>
          </label>
        </RibbonGroup>
        {(
          <RibbonGroup label="Good to know (back)" className="w-80">
            <fieldset>
              <legend className="sr-only">“Good to know” on the back</legend>
              <div className="space-y-1">
                {infoSections.map((x) => {
                  const on = backIds.has(x.id)
                  const bold = boldIds.has(x.id)
                  return (
                    <div key={x.id} className="flex items-center gap-1.5">
                      <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink-soft">
                        <input
                          type="checkbox"
                          className="size-4 accent-ink"
                          checked={on}
                          onChange={(e) => {
                            const n = new Set(backIds)
                            if (e.target.checked) n.add(x.id)
                            else n.delete(x.id)
                            setBackPick(n)
                          }}
                        />
                        <span className={cn('truncate', on && bold && 'font-semibold text-ink')}>{x.title || 'Untitled'}</span>
                        {x.own ? <Badge tone="gray">Print only</Badge> : x.edited ? <Badge tone="gray">Edited</Badge> : null}
                      </label>
                      <button
                        type="button"
                        aria-label={`Edit for print: ${x.title || 'Untitled'}`}
                        title="Change the wording for print (the website keeps its own)"
                        onClick={() => setEditing({ id: x.id, title: x.title, body: x.body, own: x.own, site: x.site })}
                        className="grid size-7 shrink-0 place-items-center rounded-md border border-line text-muted transition hover:border-ink-soft hover:text-ink"
                      >
                        <PenLine aria-hidden="true" className="size-3.5" />
                      </button>
                      {on && (
                        <button
                          type="button"
                          aria-pressed={bold}
                          aria-label={`Bold title: ${x.title || 'Untitled'}`}
                          title={bold ? 'Title prints in bold — click for normal' : 'Print this title in bold'}
                          onClick={() => toggleBold(x.id)}
                          className={cn(
                            'grid size-7 shrink-0 place-items-center rounded-md border transition',
                            bold ? 'border-ink bg-ink text-paper' : 'border-line text-muted hover:border-ink-soft hover:text-ink',
                          )}
                        >
                          <Bold aria-hidden="true" className="size-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  const id = `own-${Date.now().toString(36)}`
                  setBackPick(new Set([...backIds, id]))
                  setEditing({ id, title: '', body: '', own: true, site: null })
                }}
                className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-cream px-3 text-xs text-ink hover:bg-linen"
              >
                <Plus aria-hidden="true" className="size-3.5" /> Add your own
              </button>
              <p className={cn('mt-1 text-xs', backFit.overflow ? 'text-rose' : 'text-muted')}>
                {backFit.overflow
                  ? 'Too much for the back — untick a section or shorten it.'
                  : backFit.fit < 1
                    ? 'Fits, with slightly smaller text.'
                    : 'Changes here are for print only — Website Settings keeps its own wording.'}
              </p>
            </fieldset>
          </RibbonGroup>
        )}
      </RibbonPane>

      <RibbonPane pane="details">
        <RibbonGroup label="Back of the card" className="w-72">
          <OurDetailsSwitches value={ours} onChange={(v) => update({ ours: { ...prefs.ours, invitations: v } })} note="The front of the invitation always shows the baby’s name and the date." />
        </RibbonGroup>
      </RibbonPane>

      <RibbonPane pane="print">
        <RibbonGroup label="What to print" className="w-72">
          <div>
            
            <p className="mt-1 text-xs text-muted">
              {printSide === 'both' ? 'For printers that print both sides automatically (duplex).' : 'Print the fronts, put the pages back in the printer, then print the backs.'}
            </p>
          </div>
          {groups.length > 1 && (
            <label className="flex items-center justify-between gap-2 text-sm text-ink-soft">
              Sheets
              <select className="input-base min-h-10 w-auto max-w-[60%] py-1.5" value={sheetNo} onChange={(e) => setSheetNo(Number(e.target.value))}>
                <option value={0}>All {groups.length} sheets</option>
                {groups.map((g, i) => (
                  <option key={i} value={i + 1}>
                    Sheet {i + 1}: {g.map((x) => x.inviteeName.split(' ')[0]).join(', ')}
                  </option>
                ))}
              </select>
            </label>
          )}
          {printSide !== 'front' && (
            <label className="flex items-start justify-between gap-3 text-sm text-ink-soft">
              <span>
                Turn the backs upside-down
                <span className="block text-xs text-muted">Tick this if your test print came out with the “▲ TOP EDGE” labels on opposite edges.</span>
              </span>
              <input type="checkbox" checked={rotateBacks} onChange={(e) => setRotateBacks(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-ink" />
            </label>
          )}
        </RibbonGroup>
        <DuplexPanel prefs={prefs} update={update} testing={lineUp.testing} onTest={lineUp.setTesting} showMirror={false} />
      </RibbonPane>

      <RibbonPane pane="side">
      <aside className="space-y-4 print:hidden">
        {(overflowing.length > 0 || backFit.overflow) && (
          <div role="alert" className="rounded-xl border border-rose/40 bg-rose/5 p-4 text-sm text-ink-soft">
            <p className="flex items-center gap-2 font-medium text-rose">
              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
              {overflowing.length > 0
                ? `${overflowing.length} ${overflowing.length === 1 ? 'invitation doesn’t' : 'invitations don’t'} fit inside the border`
                : 'The back of the card doesn’t fit'}
            </p>
            {overflowing.length > 0 && (
              <>
                <p className="mt-1">{overflowing.map((i) => i.inviteeName).join(', ')}</p>
                <p className="mt-1 text-xs text-muted">
                  Even with smaller text the words reach the border. Shorten the position, the “addressed as” or the included guests’ names, use a shorter venue name in Website
                  Settings{qrOnBack ? '' : ', or move the RSVP QR to the back'}.
                </p>
              </>
            )}
            {backFit.overflow && (
              <p className="mt-1 text-xs text-muted">
                The back: untick a “Good to know” section below, or shorten its text in Website Settings.
              </p>
            )}
          </div>
        )}
        <section aria-label="Guests to print" className="rounded-xl border border-line bg-paper p-4 shadow-soft">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="font-sans text-sm font-semibold text-ink">Guests to print</h2>
            <p aria-live="polite" data-selected-count className="text-xs text-muted">
              <strong className="font-semibold text-ink">{chosen.length}</strong> of {list.length} selected
            </p>
          </div>
          <div role="radiogroup" aria-label="Which invitations" className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-cream p-1">
            {(
              [
                { v: false, l: 'No reply yet' },
                { v: true, l: 'Everyone' },
              ] as const
            ).map((o) => (
              <button
                key={o.l}
                type="button"
                role="radio"
                aria-checked={showAll === o.v}
                onClick={() => setShowAll(o.v)}
                className={cn('min-h-9 rounded-md px-2 text-sm transition', showAll === o.v ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
              >
                {o.l}
              </button>
            ))}
          </div>
          <div className="mb-2">
            <FilterTabs
              label="Guest side"
              value={side}
              onChange={setSide}
              options={[
                { value: 'all', label: 'All', count: active.length },
                { value: 'groom', label: 'Dad', count: bySide(active, 'groom').length },
                { value: 'bride', label: 'Mom', count: bySide(active, 'bride').length },
                ...(bySide(active, 'none').length > 0 ? [{ value: 'none' as const, label: 'No side', count: bySide(active, 'none').length }] : []),
              ]}
            />
          </div>
          <div className="mb-2">
            <GuestSearch value={q} onChange={setQ} count={shown.length} total={list.length} label="Search invitations" />
          </div>
          <div className="mb-1 flex flex-wrap gap-1.5">
            <button type="button" className="min-h-9 rounded-md bg-cream px-3 text-sm text-ink transition hover:bg-linen" onClick={() => setSelected(new Set([...selected, ...shown.filter((i) => !i.printedAt).map((i) => i.id)]))}>
              Select not yet printed
            </button>
            <button type="button" className="min-h-9 rounded-md bg-cream px-3 text-sm text-ink transition hover:bg-linen" onClick={() => setSelected(new Set([...selected, ...shown.map((i) => i.id)]))}>
              Select {q.trim() ? 'these' : 'all'}
            </button>
            <button type="button" disabled={!selected.size} className="min-h-9 rounded-md px-3 text-sm text-muted transition hover:bg-cream disabled:opacity-40" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
          {list.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{showAll ? 'No invitations yet.' : 'Everyone has replied. 🎉 Choose “Everyone” to print anyway.'}</p>
          ) : (
            <ul aria-label="Invitations" className="-mx-1 max-h-[55vh] divide-y divide-line overflow-y-auto xl:max-h-none xl:overflow-visible">
              {shown.map((i) => {
                const withNames = i.guests.filter((g) => g.addedBy === 'admin').map((g) => g.guestName)
                const open = cardOpen === i.id
                return (
                  <li key={i.id} className="py-1">
                    <div className="flex items-start gap-2 rounded-md px-1 py-1 hover:bg-cream/60">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-sm">
                        <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} className="mt-0.5 size-4 shrink-0 accent-ink" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-ink">{i.inviteeName}</span>
                          <span className="block truncate text-xs text-muted">
                            {[SIDE_LABEL[i.side], i.tableNumber, withNames.length ? `+ ${withNames.join(', ')}` : ''].filter(Boolean).join(' · ')}
                          </span>
                          {addressedOf(i) && <span className="block truncate font-serif text-[0.95rem] italic text-gold">“{addressedOf(i)}”</span>}
                        </span>
                      </label>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        {i.printedAt ? <Badge tone="gray">Printed {formatDateTime(i.printedAt).split(',')[0]}</Badge> : null}
                        {fitOf(i).overflow ? (
                          <span title="Doesn’t fit inside the border" className="flex items-center gap-1 text-xs font-medium text-rose">
                            <TriangleAlert aria-hidden="true" className="size-3.5" /> Too long
                          </span>
                        ) : (
                          fitOf(i).fit < 1 && <span title="Printed with slightly smaller text so it fits" className="text-xs text-muted">Smaller text</span>
                        )}
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-label={`Edit card: ${i.inviteeName}`}
                          onClick={() => setCardOpen(open ? null : i.id)}
                          className={cn('inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs transition', open ? 'bg-ink text-paper' : 'text-gold hover:bg-cream')}
                        >
                          <PenLine aria-hidden="true" className="size-3.5" /> Edit card
                        </button>
                      </span>
                    </div>
                    {open && (
                      <div className="mb-2 ml-8 mt-1 space-y-1 rounded-lg bg-cream/60 p-2">
                        <PositionPicker invitation={effective(i)} onSave={(mode, label) => void savePosition(i, mode, label)} />
                        <AddressedAsEditor invitation={i} value={addressedOf(i)} included={withNames} onSave={(text) => void saveAddressed(i, text)} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
        <TipsFold title="Printing both sides by hand">
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>Try one sheet on plain paper first.</li>
            <li>
              Choose <strong>Fronts</strong> and print.
            </li>
            <li>Put the printed page back into the tray so the blank side will be printed (check your printer’s paper icon), keeping the “▲ TOP EDGE” in mind.</li>
            <li>
              Choose <strong>Backs</strong> and print.
            </li>
            <li>Hold it up to a light: both “▲ TOP EDGE” labels should be on the same edge and the corner marks should line up. If the back is upside-down, tick “Turn the backs upside-down”.</li>
          </ol>
          <p className="mt-2 text-xs text-muted">One sheet at a time? Pick it under “Sheets”. The back has no border, so a millimetre of printer drift won’t show.</p>
          {qrOnBack && (
            <p className="mt-2 text-xs text-muted">
              With the QR on the back, every back belongs to one guest. Print the backs for the same sheet you just printed, without shuffling the pages —
              the back of each card shows the guest’s QR in the right place.
            </p>
          )}
        </TipsFold>
        <TipsFold title="What’s on each card">
          <p>
            Each card has the guest’s name, their included guests, your date and venues, and a <strong>personal QR code</strong> that opens their own
            invitation — no typing needed. Tables are never printed.
          </p>
          <p className="mt-2">In the print dialog choose <strong>Actual size / 100%</strong>, turn off headers & footers, and use thick paper (200 gsm or more). Cut along the corner marks.</p>
        </TipsFold>
      </aside>
      </RibbonPane>
      <section aria-label="Print preview" className="min-w-0" ref={box.ref}>
        <ViewToggle view={view} onChange={setView} />
        {view === '3d' && !lineUp.testing ? (
          <Card3D
            tint={paperFit.tint}
            width={box.width}
            widthMm={CARD_SIZES[size].w}
            heightMm={CARD_SIZES[size].h}
            frontHtml={chosen[0] ? frontFor(chosen[0], fitOf(chosen[0]).fit) : frontFor(SAMPLE_GUEST as InvitationWithRSVP)}
            backHtml={backFor(chosen[0] ?? null, backFit.fit)}
          />
        ) : sample && !lineUp.testing ? (
          <div className="print:hidden">
            <p data-sample-note className="mb-3 rounded-lg border border-dashed border-gold/50 bg-champagne-light/30 px-3 py-2 text-sm text-ink-soft">
              This is a <strong>sample</strong>. Tick guests in <em>Guests to print</em> to see — and print — their own invitations.
            </p>
            <Sheets paper={paper} tint={paperFit.tint} sheets={sheets} />
          </div>
        ) : (
          <Sheets paper={paper} tint={paperFit.tint} sheets={sheets} />
        )}
      </section>
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.own ? 'Your own “Good to know”' : 'Edit for print'}
        description={editing?.own ? 'Printed on the back of the invitations only — it doesn’t show on the website.' : 'Only the printed cards change. Website Settings keeps its own wording.'}
        footer={
          editing && (
            <div className="flex flex-wrap justify-between gap-2">
              <div className="flex gap-2">
                {editing.own && gtkExtra.some((x) => x.id === editing.id) && (
                  <Button variant="danger-quiet" onClick={() => gtkDelete(editing.id)} icon={<Trash2 aria-hidden="true" className="size-4" />}>
                    Delete
                  </Button>
                )}
                {!editing.own && gtkEdits[editing.id] && (
                  <Button variant="ghost" onClick={() => gtkReset(editing.id)} icon={<RotateCcw aria-hidden="true" className="size-4" />}>
                    Use the website’s text
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button disabled={!editing.title.trim() && !editing.body.trim()} onClick={() => gtkSave(editing)}>
                  Save for print
                </Button>
              </div>
            </div>
          )
        }
      >
        {editing && (
          <div className="space-y-3">
            <label className="block text-sm text-ink-soft">
              Title
              <input className="input-base mt-1.5" value={editing.title} maxLength={60} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </label>
            <MarkedTextEditor
              label="Text"
              value={editing.body}
              rows={5}
              maxLength={600}
              accent={theme.accent}
              onChange={(v) => setEditing({ ...editing, body: v })}
              hint="Select words, then Bold, Italic or Gold. A blank line starts a new paragraph."
            />
            {editing.site && (editing.site.title !== editing.title || editing.site.body !== editing.body) && (
              <p className="rounded-lg bg-cream/70 p-3 text-xs text-muted">
                On the website: <b className="text-ink-soft">{editing.site.title}</b> — {editing.site.body.slice(0, 160)}
                {editing.site.body.length > 160 ? '…' : ''}
              </p>
            )}
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(frontEditing)}
        onClose={() => setFrontEditing(null)}
        title="Venue — wording for print"
        description="Only the printed invitations change. Website Settings keeps its own wording."
        footer={
          frontEditing && (
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                {frontText[frontEditing.key] !== undefined && (
                  <Button variant="ghost" onClick={() => frontSave(frontEditing.key, null)} icon={<RotateCcw aria-hidden="true" className="size-4" />}>
                    Use the website’s text
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setFrontEditing(null)}>
                  Cancel
                </Button>
                <Button disabled={!unmarked(frontEditing.text).trim()} onClick={() => frontSave(frontEditing.key, frontEditing.text.replace(/[ \t]+$/gm, '').trim())}>
                  Save for print
                </Button>
              </div>
            </div>
          )
        }
      >
        {frontEditing && (
          <div className="space-y-3">
            <MarkedTextEditor
              label="Venue line"
              value={frontEditing.text}
              rows={3}
              maxLength={200}
              accent={theme.accent}
              onChange={(v) => setFrontEditing({ ...frontEditing, text: v })}
              hint="Select words (e.g. the place name), then Bold, Italic or Gold. Enter starts a new line on the card."
            />
            {frontEditing.text !== siteFront[frontEditing.key] && siteFront[frontEditing.key] && (
              <p className="rounded-lg bg-cream/70 p-3 text-xs text-muted">
                On the website: <b className="text-ink-soft">{siteFront[frontEditing.key]}</b>
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------- envelope

function EnvelopeTab({ paper, design, prefs, update }: { paper: Paper; design: StyleId } & PrefsProps) {
  const { settings } = useWeddingSettings()
  const mono = useMonogram()
  const monogramArt = mono ? { src: mono.src, aspect: mono.aspect } : null
  const [copies, setCopies] = useState(1)
  const withQr = prefs.envelopeQr
  const setWithQr = (v: boolean) => update({ envelopeQr: v })
  const [giftQr, setGiftQr] = useState<string | null>(null)
  const paperFit = useMemo(() => forPaper({ ...readTheme(), style: design, frame: prefs.cardBorder !== false }, prefs.printOn, prefs.paperColour), [settings?.theme, design, prefs.printOn, prefs.paperColour, prefs.cardBorder])
  const theme = paperFit.theme
  const [view, setView] = useState<View>('sheets')
  const box = useWidth()

  useEffect(() => {
    getGiftSettings()
      .then((g) => setGiftQr(g.qrImageUrl || null))
      .catch(() => setGiftQr(null))
  }, [])

  const s = SHEETS[paper]
  const envOptions = {
    coupleNames: settings?.babyName ?? '',
    dateText: settings ? formatWeddingDate(settings.weddingDate, 'full') : '',
    monogram: settings ? babyMonogram(settings.babyName) : '',
    monogramArt,
    theme,
    ceremony: prefs.envCeremony === false ? '' : [settings?.churchName, settings?.ceremonyTime].filter(Boolean).join(' · '),
    reception: '',
    giftQrUrl: withQr ? giftQr : null,
    showDate: prefs.envDate !== false,
    showSeal: prefs.envSeal !== false,
  }
  const envSvg = envelopeSvg(envOptions)
  // The 3D preview needs the paper filled in (on coloured paper nothing is printed there).
  const envSvg3d = paperFit.tint ? envelopeSvg({ ...envOptions, theme: { ...theme, paper: paperFit.tint } }) : envSvg
  const sheetHtml = `<div style="position:absolute;left:${(s.w - ENV_FLAT.w) / 2}mm;top:${(s.h - ENV_FLAT.h) / 2}mm">${envSvg}</div>` + calibrationHtml(theme)

  return (
    <div className="min-w-0">
      <PrintBar summary={printSummary([`${copies} ${copies === 1 ? 'gift envelope' : 'gift envelopes'}`, `${copies} ${copies === 1 ? 'sheet' : 'sheets'}`, SHEETS[paper].name])} note="One envelope per sheet. In the print window choose Actual size (100%).">
        <Button className="sm:min-w-40" onClick={() => window.print()} icon={<Printer aria-hidden="true" className="size-4" />}>
          Print {copies} {copies === 1 ? 'envelope' : 'envelopes'}
        </Button>
      </PrintBar>
      <RibbonPane pane="content">
        <RibbonGroup label="Envelopes" className="w-72">
          <label className="flex items-center justify-between gap-2 text-sm text-ink-soft">
            Number of envelopes
            <input
              type="number"
              min={1}
              max={50}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Math.min(50, Math.trunc(Number(e.target.value) || 1))))}
              className="input-base min-h-10 w-24 py-1.5"
            />
          </label>
          <label className={cn('flex items-center justify-between gap-2 text-sm', giftQr ? 'text-ink-soft' : 'text-muted')}>
            <span>
              Gift QR on the envelope
              <span className="block text-xs text-muted">
                {giftQr ? 'Printed on the front: “Or send your gift online”. Without it, your monogram seal goes there.' : 'Upload your GCash / InstaPay QR in Website Settings first.'}
              </span>
            </span>
            <input type="checkbox" disabled={!giftQr} checked={Boolean(giftQr) && withQr} onChange={(e) => setWithQr(e.target.checked)} className="size-5 shrink-0 accent-ink" />
          </label>
        </RibbonGroup>
        <RibbonGroup label="Front of the envelope" className="w-64">
            <label className="flex items-center justify-between gap-3 text-sm text-ink-soft">
              <span>
                Venue
              </span>
              <input type="checkbox" checked={prefs.envCeremony !== false} onChange={(e) => update({ envCeremony: e.target.checked })} className="size-5 shrink-0 accent-ink" />
            </label>
        </RibbonGroup>
      </RibbonPane>
      <RibbonPane pane="details">
        <RibbonGroup label="Our details" className="w-72">
            <p className="text-xs text-muted">The baby’s name always shows on the front.</p>
            <label className="flex items-center justify-between gap-3 text-sm text-ink-soft">
              <span>
                Shower date
              </span>
              <input type="checkbox" checked={prefs.envDate !== false} onChange={(e) => update({ envDate: e.target.checked })} className="size-5 shrink-0 accent-ink" />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-ink-soft">
              <span>
                Monogram seal<span className="block text-xs text-muted">On the front (without a gift QR) and on the closing flap.</span>
              </span>
              <input type="checkbox" checked={prefs.envSeal !== false} onChange={(e) => update({ envSeal: e.target.checked })} className="size-5 shrink-0 accent-ink" />
            </label>
        </RibbonGroup>
      </RibbonPane>
      <RibbonPane pane="side">
      <aside className="space-y-4 print:hidden">
        <TipsFold title="Folding the policy envelope">
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>
              Print at <strong>Actual size / 100%</strong> on 120–160 gsm paper. The bar at the bottom should measure 5 cm.
            </li>
            <li>Cut along the solid outline (including the little half-circle).</li>
            <li>Fold the long glue strip and the short bottom flap <strong>inwards</strong>, towards the blank side.</li>
            <li>Put glue on them (where it says “GLUE”), then fold the back panel under the front along the long dashed line and press it onto them — the back stays clear for the message.</li>
            <li>Slip the bills in flat through the top, then fold the rounded flap down over the back — close it with a sticker.</li>
          </ol>
          <p className="mt-2 text-xs text-muted">Finished size about 9.2 × 18.5 cm — peso bills fit without folding. Guests write a message and their name on the back.</p>
        </TipsFold>
      </aside>
      </RibbonPane>
      <section aria-label="Print preview" className="min-w-0" ref={box.ref}>
        <ViewToggle view={view} onChange={setView} />
        {view === '3d' ? (
          <Envelope3D svg={envSvg3d} paper={paperFit.tint ?? theme.paper} width={box.width} />
        ) : (
          <Sheets paper={paper} tint={paperFit.tint} sheets={Array.from({ length: copies }, () => sheetHtml)} />
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- attire guide

/**
 * Attire guide inserts: the motif on the first card, then the outfit photos —
 * a gentleman's and a lady's look side by side (paired by upload order), any
 * look without a partner on its own — flowing onto as many cards as needed.
 * Same card size and sheets as the invitations; printed on one side.
 */
function AttireTab({ paper, design, prefs, update }: { paper: Paper; design: StyleId } & PrefsProps) {
  const { settings } = useWeddingSettings()
  const mono = useMonogram()
  const monogramArt = mono ? { src: mono.src, aspect: mono.aspect } : null
  const [outfits, setOutfits] = useState<OutfitImage[] | null>(null)
  const [sets, setSets] = useState(1)
  const [withMotif, setWithMotif] = useState(true)
  const [note, setNote] = useState('Soft pastels welcome — wear pink or blue for your team!')
  const [side, setSide] = useState<'front' | 'back' | 'both'>('front')
  const [lowRes, setLowRes] = useState<string[]>([])
  const paperFit = useMemo(() => forPaper({ ...readTheme(), style: design, frame: prefs.cardBorder !== false }, prefs.printOn, prefs.paperColour), [settings?.theme, design, prefs.printOn, prefs.paperColour, prefs.cardBorder])
  const theme = paperFit.theme
  const size = prefs.size
  const ours = { ...ALL_DETAILS, ...(prefs.ours?.attire ?? {}) }
  const card = CARD_SIZES[size]
  const perSheet = card.perSheet[paper]
  const s = SHEETS[paper]

  useEffect(() => {
    listVisibleOutfits()
      .then(setOutfits)
      .catch(() => setOutfits([]))
  }, [])

  // Photos smaller than about 450 px across print soft at this size.
  useEffect(() => {
    if (!outfits?.length) return
    let alive = true
    Promise.all(
      outfits.map(
        (o) =>
          new Promise<string | null>((resolve) => {
            const img = new Image()
            img.onload = () => resolve(Math.min(img.naturalWidth, img.naturalHeight) < 450 ? o.caption || (o.gender === 'male' ? 'A gentleman’s look' : 'A lady’s look') : null)
            img.onerror = () => resolve(null)
            img.src = o.imageUrl
          }),
      ),
    ).then((r) => alive && setLowRes(r.filter((x): x is string => Boolean(x))))
    return () => {
      alive = false
    }
  }, [outfits])

  const photo = (o: OutfitImage) => ({ url: o.imageUrl, label: o.caption || (o.gender === 'male' ? 'For him' : 'For her'), tag: o.label || undefined })
  const male = (outfits ?? []).filter((o) => o.gender === 'male').map(photo)
  const female = (outfits ?? []).filter((o) => o.gender === 'female').map(photo)
  const swatches = (settings?.motifColors ?? []).filter((c) => c.hex).map((c) => ({ name: c.name, hex: c.hex }))
  const motifOn = withMotif && (swatches.length > 0 || Boolean(note.trim()))
  const pages = attirePages(male, female, motifOn)
  const oneCard = prefs.attireLayout !== 'cards'
  const avoidPref = { ...DEFAULT_PRINTABLE_PREFS.attireAvoid, ...(prefs.attireAvoid ?? {}) }
  const avoid = avoidPref.on && avoidItems(avoidPref.items).length ? { title: avoidPref.title.trim() || 'Please refrain from wearing', items: avoidItems(avoidPref.items) } : undefined
  const setAvoid = (patch: Partial<typeof avoidPref>) => update({ attireAvoid: { ...avoidPref, ...patch } })
  const cards = oneCard
    ? male.length || female.length || motifOn
      ? [
          attireOneCardHtml({
            title: settings?.outfitTitle?.trim() || 'What to wear',
            motifTitle: motifOn ? settings?.motifTitle?.trim() || 'Our motif' : undefined,
            swatches: withMotif ? swatches : undefined,
            note: withMotif ? note.trim() || undefined : undefined,
            male,
            female,
            avoid,
            theme,
            size,
          }),
        ]
      : []
    : pages.map((items, i) =>
    attireCardHtml({
      title: settings?.outfitTitle?.trim() || 'What to wear',
      motifTitle: i === 0 && motifOn ? settings?.motifTitle?.trim() || 'Our motif' : undefined,
      swatches: i === 0 && withMotif ? swatches : undefined,
      note: i === 0 && withMotif ? note.trim() || undefined : undefined,
      items,
      page: i + 1,
      pages: pages.length,
      avoid: i === pages.length - 1 ? avoid : undefined,
      theme,
      size,
    }),
  )
  // Every set holds each card once; cards fill the sheets in order.
  const all = Array.from({ length: sets }, () => cards).flat()
  const groups = chunk(all, perSheet)
  // The back: your monogram crest (as in the website's header), names and date — the same on every card.
  const backHtml = settings
    ? invitationBackHtml({ coupleNames: settings.babyName, dateText: formatWeddingDate(settings.weddingDate), monogram: babyMonogram(settings.babyName), monogramArt, theme, size, show: ours })
    : ''
  const fronts = groups.map((group, gi) => {
    const pos = layoutRow(s.w, s.h, group.length === perSheet ? perSheet : group.length, card.w, card.h)
    return (
      group.map((html, k) => `<div style="position:absolute;left:${pos[k].x}mm;top:${pos[k].y}mm">${html}</div>`).join('') +
      cropMarksSvg(s.w, s.h, pos, theme.muted) +
      orientationMarkHtml('front', gi + 1, groups.length, theme) +
      calibrationHtml(theme)
    )
  })
  const lineUp = useLineUp(paper, theme, prefs)
  const backs = groups.map((group, gi) => {
    const pos = layoutRow(s.w, s.h, group.length === perSheet ? perSheet : group.length, card.w, card.h)
    return lineUp.back(
      pos.map((p) => `<div style="position:absolute;left:${p.x}mm;top:${p.y}mm">${backHtml}</div>`).join('') +
      cropMarksSvg(s.w, s.h, pos, theme.muted) +
      orientationMarkHtml('back', gi + 1, groups.length, theme)
    )
  })
  const sheets = lineUp.testing ? lineUp.test(side) : side === 'front' ? fronts : side === 'back' ? backs : fronts.flatMap((f, i) => [f, backs[i]])

  return (
    <div className="min-w-0">
      <PrintBar summary={lineUp.testing ? printSummary(['Line-up test', `${sheets.length} ${sheets.length === 1 ? 'page' : 'pages'}`, SHEETS[paper].name]) : printSummary(['Attire guide', `${sheets.length} ${sheets.length === 1 ? 'sheet' : 'sheets'}`, SHEETS[paper].name, CARD_SIZES[size].label])}>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <span className="sr-only">Print</span>
          <select className="input-base min-h-10 w-auto py-1.5" aria-label="What to print" value={side} onChange={(e) => setSide(e.target.value as typeof side)}>
            <option value="front">Fronts</option>
            <option value="back">Backs</option>
            <option value="both">Both sides</option>
          </select>
        </label>
        <Button className="sm:min-w-40" disabled={!cards.length} onClick={() => window.print()} icon={<Printer aria-hidden="true" className="size-4" />}>
          Print {sheets.length} {sheets.length === 1 ? 'sheet' : 'sheets'}
        </Button>
      </PrintBar>
      <RibbonPane pane="content">
        <RibbonGroup label="Layout" className="w-72">
          <div>
            <div role="radiogroup" aria-label="Attire layout" className="grid grid-cols-2 gap-1 rounded-lg bg-cream p-1">
              {(
                [
                  { v: 'one', l: 'One card' },
                  { v: 'cards', l: 'Spread over cards' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  role="radio"
                  aria-checked={(prefs.attireLayout ?? 'one') === opt.v}
                  onClick={() => update({ attireLayout: opt.v })}
                  className={cn('rounded-md px-2 py-1.5 text-sm transition', (prefs.attireLayout ?? 'one') === opt.v ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
                >
                  {opt.l}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">
              {oneCard ? 'Every look and the motif on a single card — a column for each label, his look above hers.' : 'Bigger photos, one or two looks per card.'}
            </p>
          </div>
        </RibbonGroup>
        <RibbonGroup label="Sets & motif" className="w-80">
          <label className="flex items-center justify-between gap-2 text-sm text-ink-soft">
            <span>
              Sets to print
              <span className="block text-xs text-muted">One set = {cards.length} {cards.length === 1 ? 'card' : 'cards'}, for one invitation.</span>
            </span>
            <input
              type="number"
              min={1}
              max={200}
              value={sets}
              onChange={(e) => setSets(Math.max(1, Math.min(200, Math.trunc(Number(e.target.value) || 1))))}
              className="input-base min-h-10 w-24 py-1.5"
            />
          </label>
          <label className="flex items-start justify-between gap-3 text-sm text-ink-soft">
            <span>
              Motif colours on the first card
              <span className="block text-xs text-muted">{swatches.length ? `${swatches.length} colours from your Outfit Gallery settings.` : 'Add motif colours in Outfit Gallery first.'}</span>
            </span>
            <input type="checkbox" checked={withMotif} onChange={(e) => setWithMotif(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-ink" />
          </label>
          {withMotif && (
            <label className="block text-sm text-ink-soft">
              Note under the colours
              <input className="input-base mt-1.5" value={note} maxLength={90} onChange={(e) => setNote(e.target.value)} />
            </label>
          )}
        </RibbonGroup>
        <RibbonGroup label="Please don’t wear" className="w-80">
          <label className="flex items-start justify-between gap-3 text-sm text-ink-soft">
            <span>
              Highlighted note at the bottom
              <span className="block text-xs text-muted">{oneCard ? 'Under the looks.' : 'Under the looks on the last card.'}</span>
            </span>
            <input type="checkbox" checked={avoidPref.on} onChange={(e) => setAvoid({ on: e.target.checked })} className="mt-0.5 size-5 shrink-0 accent-ink" />
          </label>
          {avoidPref.on && (
            <>
              <label className="block text-sm text-ink-soft">
                Heading
                <input className="input-base mt-1.5 min-h-9 py-1" value={avoidPref.title} maxLength={50} onChange={(e) => setAvoid({ title: e.target.value })} />
              </label>
              <label className="block text-sm text-ink-soft">
                What not to wear
                <textarea
                  className="input-base mt-1.5 py-1.5 leading-snug"
                  rows={4}
                  maxLength={300}
                  value={avoidPref.items}
                  onChange={(e) => setAvoid({ items: e.target.value })}
                  placeholder={'Slippers\nSando\nShorts'}
                />
                <span className="mt-1 block text-xs text-muted">One per line (or separated by commas) — up to 12.</span>
              </label>
            </>
          )}
        </RibbonGroup>
      </RibbonPane>
      <RibbonPane pane="details">
        <RibbonGroup label="Back of the card" className="w-72">
          <OurDetailsSwitches value={ours} onChange={(v) => update({ ours: { ...prefs.ours, attire: v } })} />
        </RibbonGroup>
      </RibbonPane>
      <RibbonPane pane="print">
        <DuplexPanel prefs={prefs} update={update} testing={lineUp.testing} onTest={lineUp.setTesting} showMirror={false} />
      </RibbonPane>
      <RibbonPane pane="side">
      <aside className="space-y-4 print:hidden">
        {outfits && outfits.length === 0 && (
          <p className="rounded-lg border border-line bg-paper p-3 text-sm text-muted">No outfit photos yet — add them in Outfit Gallery. The card shows just the motif until then.</p>
        )}
        {lowRes.length > 0 && (
          <p className="flex items-start gap-2 rounded-lg border border-gold/40 bg-champagne-light/30 p-3 text-sm text-ink-soft">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gold" />
            <span>
              {lowRes.length === 1 ? 'One photo is' : `${lowRes.length} photos are`} small and may print a little soft: {lowRes.slice(0, 3).join(', ')}
              {lowRes.length > 3 ? '…' : ''}. Larger photos (at least 1000 px) print best.
            </span>
          </p>
        )}
        <TipsFold title="Printing the attire guide">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              Landscape sheets, {perSheet} cards per {SHEETS[paper].name} ({SHEETS[paper].size}) sheet. Print at <strong>Actual size / 100%</strong>.
            </li>
            <li>
              For a printed back: print <strong>Fronts</strong>, put the sheets back in the printer turned over (flip on the long edge), then print <strong>Backs</strong> — or choose
              <strong> Both sides</strong> on a two-sided printer.
            </li>
            <li>Gentleman’s and lady’s looks are paired by their order in Outfit Gallery (first with first, and so on); each pair’s label is printed once above it.</li>
            <li>Photos look best on matte or photo card stock. Cut along the crop marks and tuck the cards in with the invitation.</li>
          </ul>
        </TipsFold>
      </aside>
      </RibbonPane>
      <section aria-label="Print preview" className="min-w-0">
        <p className="mb-3 text-sm text-muted print:hidden">
          {cards.length} {cards.length === 1 ? 'card' : 'cards'} per set · {CARD_SIZES[size].label}
        </p>
        {outfits === null ? <p className="py-10 text-center text-sm text-muted">Loading outfit photos…</p> : <Sheets paper={paper} tint={paperFit.tint} sheets={sheets} />}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- thank-you cards

/** Thank-you cards: your message on the front, your monogram on the back. The same card for everyone, or one per guest. */
function ThankYouTab({ paper, design, prefs, update }: { paper: Paper; design: StyleId } & PrefsProps) {
  const { settings } = useWeddingSettings()
  const { data } = useAdminData()
  const mono = useMonogram()
  const monogramArt = mono ? { src: mono.src, aspect: mono.aspect } : null
  const [mode, setMode] = useState<'same' | 'personal'>('same')
  const [copies, setCopies] = useState(10)
  const [side, setSide] = useState<'front' | 'back' | 'both'>('front')
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useKept<Set<string>>('thanks-selected', new Set())
  const [fits, setFits] = useState<Record<string, CardFit>>({})
  const measureHost = useRef<HTMLDivElement>(null)
  const paperFit = useMemo(() => forPaper({ ...readTheme(), style: design, frame: prefs.cardBorder !== false }, prefs.printOn, prefs.paperColour), [settings?.theme, design, prefs.printOn, prefs.paperColour, prefs.cardBorder])
  const theme = paperFit.theme
  const size = prefs.size
  const ours = { ...ALL_DETAILS, ...(prefs.ours?.thanks ?? {}) }
  const [q, setQ] = useState('')
  const card = CARD_SIZES[size]
  const perSheet = card.perSheet[paper]
  const s = SHEETS[paper]
  const title = prefs.thanksTitle ?? 'Thank you'
  const message = prefs.thanksMessage ?? ''
  const sign = prefs.thanksSign ?? ''

  const guests = useMemo(
    () => (data?.invitations ?? []).filter((i) => i.isActive && (showAll || i.status === 'attending')).sort((a, b) => a.inviteeName.localeCompare(b.inviteeName)),
    [data, showAll],
  )
  const nameOf = (i: InvitationWithRSVP) => i.addressedAs?.trim() || i.inviteeName
  const chosen = mode === 'personal' ? guests.filter((g) => selected.has(g.id)) : []
  const shownGuests = q.trim() ? guests.filter((g) => matches(q, g.inviteeName, g.addressedAs, g.guests.map((x) => x.guestName).join(' '), g.tableNumber, g.side)) : guests
  const make = (guestName: string | undefined, fit = 1, sz: CardSize = size) =>
    thankYouCardHtml({
      title,
      message,
      signoff: sign,
      coupleNames: settings?.coupleNames ?? '',
      dateText: settings ? formatWeddingDate(settings.weddingDate) : '',
      guestName,
      showNames: ours.names,
      showDate: ours.date,
      theme,
      size: sz,
      fit,
    })
  const keys = mode === 'personal' ? chosen.map((g) => nameOf(g)) : ['']
  const measureKey = JSON.stringify([keys, title, message, sign, ours, size, design, settings?.theme, settings?.coupleNames])
  useEffect(() => {
    const host = measureHost.current
    if (!host || !settings) return
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (cancelled) return
      const next: Record<string, CardFit> = {}
      for (const k of keys) next[k] = measureCardFit((f) => make(k || undefined, f, '5x7'), host, 0.7)
      setFits(next)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureKey])
  const fitOf = (k: string) => fits[k] ?? { fit: 1, overflow: false }

  const fronts_ = mode === 'personal' ? chosen.map((g) => make(nameOf(g), fitOf(nameOf(g)).fit)) : Array.from({ length: copies }, () => make(undefined, fitOf('').fit))
  const backHtml = settings
    ? invitationBackHtml({ coupleNames: settings.babyName, dateText: formatWeddingDate(settings.weddingDate), monogram: babyMonogram(settings.babyName), monogramArt, theme, size, show: ours })
    : ''
  const groups = chunk(fronts_, perSheet)
  const fronts = groups.map((group, gi) => {
    const pos = layoutRow(s.w, s.h, group.length === perSheet ? perSheet : group.length, card.w, card.h)
    return group.map((h, k) => `<div style="position:absolute;left:${pos[k].x}mm;top:${pos[k].y}mm">${h}</div>`).join('') + cropMarksSvg(s.w, s.h, pos, theme.muted) + orientationMarkHtml('front', gi + 1, groups.length, theme) + calibrationHtml(theme)
  })
  const lineUp = useLineUp(paper, theme, prefs)
  const backs = groups.map((group, gi) => {
    const pos = layoutRow(s.w, s.h, group.length === perSheet ? perSheet : group.length, card.w, card.h)
    return lineUp.back(pos.map((p) => `<div style="position:absolute;left:${p.x}mm;top:${p.y}mm">${backHtml}</div>`).join('') + cropMarksSvg(s.w, s.h, pos, theme.muted) + orientationMarkHtml('back', gi + 1, groups.length, theme))
  })
  const sheets = lineUp.testing ? lineUp.test(side) : side === 'front' ? fronts : side === 'back' ? backs : fronts.flatMap((f, i) => [f, backs[i]])
  const tooLong = keys.some((k) => fitOf(k).overflow)

  return (
    <div className="min-w-0">
      <PrintBar summary={lineUp.testing ? printSummary(['Line-up test', `${sheets.length} ${sheets.length === 1 ? 'page' : 'pages'}`, SHEETS[paper].name]) : printSummary(['Thank-you cards', `${sheets.length} ${sheets.length === 1 ? 'sheet' : 'sheets'}`, SHEETS[paper].name, CARD_SIZES[size].label])}>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <span className="sr-only">Print</span>
          <select className="input-base min-h-10 w-auto py-1.5" aria-label="What to print" value={side} onChange={(e) => setSide(e.target.value as typeof side)}>
            <option value="front">Fronts</option>
            <option value="back">Backs</option>
            <option value="both">Both sides</option>
          </select>
        </label>
        <Button className="sm:min-w-40" disabled={!fronts_.length} onClick={() => window.print()} icon={<Printer aria-hidden="true" className="size-4" />}>
          Print {sheets.length} {sheets.length === 1 ? 'sheet' : 'sheets'}
        </Button>
      </PrintBar>
      <div ref={measureHost} aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, visibility: 'hidden', pointerEvents: 'none' }} />
      <RibbonPane pane="content">
        <RibbonGroup label="Cards" className="w-72">
          <div>
            
            <div role="radiogroup" aria-label="Thank-you cards" className="grid grid-cols-2 gap-1 rounded-lg bg-cream p-1">
              {(
                [
                  { v: 'same', l: 'Same for everyone' },
                  { v: 'personal', l: 'With each guest’s name' },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  role="radio"
                  aria-checked={mode === o.v}
                  onClick={() => setMode(o.v)}
                  className={cn('rounded-md px-2 py-1.5 text-sm transition', mode === o.v ? 'bg-paper text-ink shadow-soft' : 'text-muted hover:text-ink')}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        </RibbonGroup>
      </RibbonPane>
      <RibbonPane pane="details">
        <RibbonGroup label="Our details" className="w-72">
          <OurDetailsSwitches value={ours} onChange={(v) => update({ ours: { ...prefs.ours, thanks: v } })} note="Names and date: under the sign-off and on the back. Monogram: on the back." />
        </RibbonGroup>
      </RibbonPane>
      <RibbonPane pane="print">
        <DuplexPanel prefs={prefs} update={update} testing={lineUp.testing} onTest={lineUp.setTesting} showMirror={false} />
      </RibbonPane>
      <RibbonPane pane="side">
      <aside className="space-y-4 print:hidden">
        <section className="space-y-4 rounded-xl border border-line bg-paper p-4 shadow-soft">
          <label className="block text-sm text-ink-soft">
            Heading
            <input className="input-base mt-1.5" value={title} maxLength={40} onChange={(e) => update({ thanksTitle: e.target.value })} />
          </label>
          <label className="block text-sm text-ink-soft">
            Message
            <textarea className="input-base mt-1.5 min-h-36 py-2 leading-relaxed" value={message} maxLength={700} onChange={(e) => update({ thanksMessage: e.target.value })} />
            <span className="mt-1 block text-xs text-muted">A blank line starts a new paragraph.</span>
          </label>
          <label className="block text-sm text-ink-soft">
            Sign-off
            <input className="input-base mt-1.5" value={sign} maxLength={60} placeholder="With love and gratitude," onChange={(e) => update({ thanksSign: e.target.value })} />
            <span className="mt-1 block text-xs text-muted">Your names and the date follow it.</span>
          </label>
          {tooLong && <p role="alert" className="text-sm text-rose">The message is a little long for the card — shorten it, or choose a bigger card size (Page setup).</p>}
        </section>
        {mode === 'personal' ? (
          <section className="space-y-4 rounded-xl border border-line bg-paper p-4 shadow-soft">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm text-ink-soft">{showAll ? 'All invitations' : 'Attending guests'}</p>
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-ink" /> Show everyone
                </label>
              </div>
              <div className="mb-2 flex gap-2 text-xs">
                <button type="button" className="rounded-md bg-cream px-2.5 py-1.5 hover:bg-linen" onClick={() => setSelected(new Set([...selected, ...shownGuests.map((g) => g.id)]))}>
                  Select {q.trim() ? 'these' : 'all'}
                </button>
                <button type="button" className="rounded-md px-2.5 py-1.5 text-muted hover:bg-cream" onClick={() => setSelected(new Set())}>
                  Clear
                </button>
              </div>
              <div className="mb-2">
                <GuestSearch value={q} onChange={setQ} count={shownGuests.length} total={guests.length} label="Search guests for thank-you cards" />
              </div>
              {guests.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">{showAll ? 'No invitations yet.' : 'No one has confirmed yet — tick “Show everyone”.'}</p>
              ) : (
                <ul className="max-h-[40vh] divide-y divide-line overflow-y-auto">
                  {shownGuests.map((g) => (
                    <li key={g.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 text-sm hover:bg-cream/60">
                        <input
                          type="checkbox"
                          className="size-4 accent-ink"
                          checked={selected.has(g.id)}
                          onChange={() =>
                            setSelected((cur) => {
                              const n = new Set(cur)
                              if (n.has(g.id)) n.delete(g.id)
                              else n.add(g.id)
                              return n
                            })
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-ink">{nameOf(g)}</span>
                          {nameOf(g) !== g.inviteeName && <span className="block truncate text-xs text-muted">{g.inviteeName}</span>}
                        </span>
                        {g.tableNumber && <span className="shrink-0 truncate text-xs text-muted">{g.tableNumber}</span>}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-xs text-muted">Uses each invitation’s “Addressed as” (set in Paper invitations), or the guest’s name.</p>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-line bg-paper p-4 shadow-soft">
            <label className="flex items-center justify-between gap-2 text-sm text-ink-soft">
              Copies
              <input
                type="number"
                min={1}
                max={500}
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Math.min(500, Math.trunc(Number(e.target.value) || 1))))}
                className="input-base min-h-10 w-24 py-1.5"
              />
            </label>
          </section>
        )}
        <TipsFold title="Printing the thank-you cards">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              Print <strong>Fronts</strong>, put the sheets back in the printer turned over, then print <strong>Backs</strong> — or choose <strong>Both sides</strong> on a two-sided printer.
            </li>
            <li>Every back is the same, so the order of the pages doesn’t matter.</li>
            <li>
              Print at <strong>Actual size / 100%</strong> on card stock and cut along the corner marks.
            </li>
          </ul>
        </TipsFold>
      </aside>
      </RibbonPane>
      <section aria-label="Print preview" className="min-w-0">
        {fronts_.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted print:hidden">Tick guests in the list to preview their cards.</div>
        ) : (
          <Sheets paper={paper} tint={paperFit.tint} sheets={sheets} />
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- position per invitation

/** Same choices as in Add/Edit Invitation; saves to the invitation. */
function PositionPicker({ invitation, onSave }: { invitation: InvitationWithRSVP; onSave: (mode: PositionMode, label: string) => void }) {
  const [draft, setDraft] = useState(invitation.positionLabel)
  useEffect(() => setDraft(invitation.positionLabel), [invitation.positionLabel])
  const id = `pos-${invitation.id}`
  const commit = () => {
    if (draft.trim() !== invitation.positionLabel.trim()) onSave('custom', draft)
  }
  return (
    <div className="ml-8 mt-1 flex flex-wrap items-center gap-1.5 text-xs">
      <label htmlFor={id} className="text-muted">
        Position
      </label>
      <select
        id={id}
        className="input-base min-h-8 w-auto py-0.5 pl-2 pr-7 text-xs"
        value={invitation.positionMode === 'custom' ? 'custom' : 'none'}
        onChange={(e) => onSave(e.target.value as PositionMode, e.target.value === 'custom' ? draft : invitation.positionLabel)}
      >
        <option value="custom">Type it</option>
        <option value="none">Don’t show</option>
      </select>
      {invitation.positionMode === 'custom' && (
        <input
          aria-label={`Position for ${invitation.inviteeName}`}
          className="input-base min-h-8 min-w-0 flex-1 basis-32 py-0.5 text-xs"
          value={draft}
          maxLength={80}
          placeholder="e.g. Ninang"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- "addressed as" per invitation

/**
 * How one invitation is addressed ("Mr. & Mrs. Juan dela Cruz"). Suggestions
 * only fill the box — nothing is saved until Save is pressed, one
 * invitation at a time. Saved to the invitation: used on the printed card and
 * the guest's online invitation, in place of the name and "together with".
 */
function AddressedAsEditor({ invitation, value, included, onSave }: { invitation: InvitationWithRSVP; value: string; included: string[]; onSave: (text: string) => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const suggestions = useMemo(() => addressSuggestions(invitation.inviteeName, included), [invitation.inviteeName, included])
  const id = `addr-${invitation.id}`
  const start = () => {
    setDraft(value)
    setOpen(true)
  }
  const save = () => {
    onSave(draft)
    setOpen(false)
  }
  const usual = included.length ? `${invitation.inviteeName} · together with ${included.join(', ')}` : invitation.inviteeName

  if (!open) {
    return (
      <div className="ml-8 mt-1 flex min-w-0 items-center gap-1.5 text-xs">
        <span className="text-muted">Addressed as</span>
        <span className={cn('min-w-0 truncate', value ? 'font-medium text-ink' : 'text-muted')}>{value || 'the usual name'}</span>
        <button
          type="button"
          onClick={start}
          aria-label={`Change how ${invitation.inviteeName}’s invitation is addressed`}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-gold hover:bg-cream"
        >
          <PenLine aria-hidden="true" className="size-3.5" /> {value ? 'Change' : 'Set'}
        </button>
      </div>
    )
  }

  return (
    <div className="ml-8 mr-1 mt-1.5 rounded-lg border border-champagne/60 bg-champagne-light/20 p-2.5 text-xs" role="group" aria-label={`Addressed as, ${invitation.inviteeName}`}>
      <label htmlFor={id} className="mb-1 block font-medium text-ink-soft">
        Addressed as
      </label>
      <input
        id={id}
        className="input-base min-h-9 py-1 text-sm"
        value={draft}
        maxLength={120}
        placeholder={invitation.inviteeName}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            save()
          } else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {suggestions.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-muted">Suggestions — tap to use, then Save</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => setDraft(sug)}
                className={cn('rounded-full border px-2.5 py-1 transition', draft === sug ? 'border-ink bg-ink text-ivory' : 'border-line bg-paper text-ink-soft hover:border-champagne')}
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-2">
        <p className="mb-1 text-muted">Add a title in front</p>
        <div className="flex flex-wrap gap-1">
          {ADDRESS_TITLES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setDraft((d) => withTitle(d || invitation.inviteeName, t))}
              className="rounded-md border border-line bg-paper px-2 py-0.5 text-ink-soft transition hover:border-champagne"
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-muted">
        Printed after “Dear” and shown on their online invitation, in place of: <span className="italic">{usual}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button size="sm" onClick={save} disabled={draft.replace(/\s+/g, ' ').trim() === value}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {value && (
          <button
            type="button"
            className="ml-auto rounded-md px-2 py-1 text-muted hover:bg-cream hover:text-ink"
            onClick={() => {
              onSave('')
              setOpen(false)
            }}
          >
            Use the usual name
          </button>
        )}
      </div>
    </div>
  )
}
