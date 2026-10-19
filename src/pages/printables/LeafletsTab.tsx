import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { ArrowDown, ArrowUp, Copy, Plus, Printer, Trash2, TriangleAlert } from 'lucide-react'
import { useWeddingSettings } from '../../hooks/useWeddingSettings'
import { useMonogram } from '../../hooks/useMonogram'
import type { PrintablePrefs } from '../../hooks/usePrintablePrefs'
import { getGiftSettings } from '../../services/giftService'
import { listProgram } from '../../services/programService'
import type { ProgramItem } from '../../types/wedding'
import type { StyleId } from '../../theme/themes'
import { formatWeddingDate, babyMonogram } from '../../utils/formatting'
import { measureCardFit, type CardFit } from '../../utils/cardFit'
import { siteLinks } from '../../utils/share'
import { SHEETS, type Paper } from '../../utils/printables'
import { flatLayout, flatSheets, alignmentSheets, type Duplex } from '../../utils/standPrintables'
import { BLOCK_LABELS, LEAFLET_TEMPLATES, QR_SOURCES, leafletHtml, newBlock, newId, type BlockKind, type Leaflet, type LeafletBlock, type LeafletData, type QrSource } from '../../utils/leaflets'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyPreview, Panel, PrintBar, RibbonGroup, RibbonPane, Segmented, Sheets, TipsFold, printSummary } from '../../components/printables/PrintShared'
import { cn } from '../../components/ui/cn'
import { DuplexPanel, usePrintColours } from './TablePrintables'

type Props = { paper: Paper; design: StyleId; prefs: PrintablePrefs; update: (patch: Partial<PrintablePrefs>) => void }
type Side = 'front' | 'back'

function qrUrl(b: Extract<LeafletBlock, { kind: 'qr' }>): string | null {
  const l = siteLinks()
  switch (b.source) {
    case 'website':
      return l.home
    case 'rsvp':
      return l.rsvp
    case 'seat':
      return l.seat
    case 'photos':
      return `${l.home}#/photos`
    case 'custom':
      return b.url?.trim() || null
    default:
      return null
  }
}

export function LeafletsTab({ paper, design, prefs, update }: Props) {
  const { settings } = useWeddingSettings()
  const mono = useMonogram()
  const fit = usePrintColours(design, prefs)
  const leaflets = prefs.leaflets ?? []
  const [currentId, setCurrentId] = useState<string | null>(leaflets[0]?.id ?? null)
  const current = leaflets.find((l) => l.id === currentId) ?? leaflets[0] ?? null
  const [sideTab, setSideTab] = useState<Side>('front')
  const [copies, setCopies] = useState(4)
  const [printSide, setPrintSide] = useState<'front' | 'back' | 'both'>('front')
  const [testing, setTesting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [qr, setQr] = useState<Record<string, string>>({})
  const [gift, setGift] = useState<string | null>(null)
  const [program, setProgram] = useState<ProgramItem[] | null>(null)
  const [fits, setFits] = useState<Record<Side, CardFit>>({ front: { fit: 1, overflow: false }, back: { fit: 1, overflow: false } })
  const measureHost = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getGiftSettings()
      .then((g) => setGift(g.qrImageUrl || null))
      .catch(() => setGift(null))
    // The program flow from Website Settings (all of it, even while hidden on the website).
    listProgram()
      .then(setProgram)
      .catch(() => setProgram([]))
  }, [])

  // QR codes for the current leaflet.
  const qrBlocks = current ? [...current.front, ...current.back].filter((b): b is Extract<LeafletBlock, { kind: 'qr' }> => b.kind === 'qr') : []
  const qrKey = JSON.stringify(qrBlocks.map((b) => [b.id, qrUrl(b)]))
  useEffect(() => {
    let alive = true
    Promise.all(
      qrBlocks.map(async (b) => {
        const url = qrUrl(b)
        if (!url) return [b.id, ''] as const
        return [b.id, await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff00' } })] as const
      }),
    ).then((list) => alive && setQr(Object.fromEntries(list)))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrKey])

  const data: LeafletData = useMemo(
    () => ({
      coupleNames: settings?.babyName ?? '',
      dateText: settings ? formatWeddingDate(settings.weddingDate) : '',
      monogram: settings ? babyMonogram(settings.babyName) : '',
      monogramArt: mono ? { src: mono.src, aspect: mono.aspect } : null,
      ceremony: [settings?.churchName, settings?.ceremonyTime].filter(Boolean).join(' · '),
      reception: '',
      qr,
      giftQrUrl: gift,
      program: program ?? [],
      verse: { text: settings?.verseText ?? '', reference: settings?.verseReference ?? '' },
    }),
    [settings, mono, qr, gift, program],
  )

  const per = current?.perSheet ?? 2
  const { w, h } = flatLayout(paper, per)
  const make = (side: Side, f = fits[side].fit) => (current ? leafletHtml(current[side], w, h, fit.theme, design, data, f) : '')
  const measureKey = JSON.stringify([current, w, h, design, fit.theme, data.coupleNames, Object.keys(qr).length, gift, data.program, data.verse])
  useEffect(() => {
    const host = measureHost.current
    if (!host || !current) return
    let cancelled = false
    void document.fonts.ready.then(() => {
      if (cancelled) return
      setFits({
        front: measureCardFit((f) => leafletHtml(current.front, w, h, fit.theme, design, data, f), host, 0.45),
        back: current.back.length ? measureCardFit((f) => leafletHtml(current.back, w, h, fit.theme, design, data, f), host, 0.45) : { fit: 1, overflow: false },
      })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measureKey])

  const hasBack = Boolean(current?.back.length)
  const side = hasBack ? printSide : 'front'
  const duplex: Duplex = { mirror: prefs.duplexMirror, dx: prefs.duplexDx, dy: prefs.duplexDy }
  const sheets = !current
    ? []
    : testing && hasBack
      ? alignmentSheets(paper, fit.theme, duplex)
      : flatSheets(
          Array.from({ length: copies }, () => make('front')),
          hasBack ? Array.from({ length: copies }, () => make('back')) : null,
          paper,
          per,
          fit.theme,
          duplex,
          side,
        )

  const save = (l: Leaflet) => update({ leaflets: leaflets.map((x) => (x.id === l.id ? l : x)) })
  const create = (key: string) => {
    const tpl = LEAFLET_TEMPLATES.find((x) => x.key === key) ?? LEAFLET_TEMPLATES[LEAFLET_TEMPLATES.length - 1]
    const l: Leaflet = { id: newId(), ...tpl.make() }
    update({ leaflets: [...leaflets, l] })
    setCurrentId(l.id)
    setSideTab('front')
  }
  const duplicate = () => {
    if (!current) return
    const copy: Leaflet = { ...current, id: newId(), name: `${current.name} (copy)`, front: current.front.map((b) => ({ ...b, id: newId() })), back: current.back.map((b) => ({ ...b, id: newId() })) }
    update({ leaflets: [...leaflets, copy] })
    setCurrentId(copy.id)
  }
  const blocks = current ? current[sideTab] : []
  const setBlocks = (list: LeafletBlock[]) => current && save({ ...current, [sideTab]: list })
  const patch = (id: string, p: Partial<LeafletBlock>) => setBlocks(blocks.map((b) => (b.id === id ? ({ ...b, ...p } as LeafletBlock) : b)))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= blocks.length) return
    const next = [...blocks]
    ;[next[i], next[j]] = [next[j], next[i]]
    setBlocks(next)
  }

  return (
    <div className="min-w-0">
      <div ref={measureHost} aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0, visibility: 'hidden', pointerEvents: 'none' }} />
      <RibbonPane pane="side">
      <aside className="space-y-4 print:hidden">
        <Panel label="Your leaflets">
          {leaflets.length > 0 && (
            <div role="radiogroup" aria-label="Leaflet" className="flex flex-wrap gap-2">
              {leaflets.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={current?.id === l.id}
                  onClick={() => {
                    setCurrentId(l.id)
                    setTesting(false)
                  }}
                  className={cn('min-h-10 rounded-full border px-3.5 text-sm transition', current?.id === l.id ? 'border-ink bg-paper text-ink shadow-soft' : 'border-line text-ink-soft hover:border-ink-soft')}
                >
                  {l.name || 'Untitled'}
                </button>
              ))}
            </div>
          )}
          <div>
            <p className="mb-1.5 text-sm text-ink-soft">{leaflets.length ? 'Start another from' : 'Start a leaflet from'}</p>
            <div className="flex flex-wrap gap-2">
              {LEAFLET_TEMPLATES.map((t) => (
                <button key={t.key} type="button" onClick={() => create(t.key)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-cream px-3 text-sm text-ink hover:bg-linen">
                  <Plus aria-hidden="true" className="size-3.5" /> {t.name}
                </button>
              ))}
            </div>
          </div>
        </Panel>

        {current && (
          <>
            <RibbonPane pane="content">
              <RibbonGroup label="Size" className="w-80">
              <Segmented<1 | 2 | 4>
                label="Leaflets per sheet"
                value={current.perSheet}
                options={[
                  { v: 1, l: '1 (whole sheet)' },
                  { v: 2, l: '2 (half)' },
                  { v: 4, l: '4 (quarter)' },
                ]}
                onChange={(v) => save({ ...current, perSheet: v })}
              />
              <p className="text-xs text-muted">
                Each is {Math.round(w / 10)} × {Math.round(h / 10)} cm. Text and QR codes size themselves to fit.
              </p>
              </RibbonGroup>
            </RibbonPane>
            <PrintBar summary={testing ? printSummary(['Line-up test', `${sheets.length} ${sheets.length === 1 ? 'page' : 'pages'}`, SHEETS[paper].name]) : printSummary([`${copies} ${copies === 1 ? 'leaflet' : 'leaflets'}`, `${sheets.length} ${sheets.length === 1 ? 'sheet' : 'sheets'}`, SHEETS[paper].name])}>
              {hasBack && (
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  <span className="sr-only">Print</span>
                  <select aria-label="What to print" className="input-base min-h-10 w-auto py-1.5" value={printSide} onChange={(e) => setPrintSide(e.target.value as typeof printSide)}>
                    <option value="front">Fronts</option>
                    <option value="back">Backs</option>
                    <option value="both">Both sides</option>
                  </select>
                </label>
              )}
              <Button className="sm:min-w-40" disabled={sheets.length === 0} onClick={() => window.print()} icon={<Printer aria-hidden="true" className="size-4" />}>
                Print {sheets.length} {sheets.length === 1 ? 'sheet' : 'sheets'}
              </Button>
            </PrintBar>
            <RibbonPane pane="print">
              <RibbonGroup label="How many" className="w-64">
              <label className="flex items-center justify-between gap-2 text-sm text-ink-soft">
                How many
                <input type="number" min={1} max={300} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(300, Math.trunc(Number(e.target.value) || 1))))} className="input-base min-h-10 w-24 py-1.5" />
              </label>
              </RibbonGroup>
            {hasBack && <DuplexPanel prefs={prefs} update={update} testing={testing} onTest={setTesting} />}
            </RibbonPane>
            <Panel label="Leaflet">
              <label className="block text-sm text-ink-soft">
                Name (just for you)
                <input className="input-base mt-1.5" value={current.name} maxLength={50} onChange={(e) => save({ ...current, name: e.target.value })} />
              </label>
              <Segmented<Side>
                label="Editing"
                value={sideTab}
                options={[
                  { v: 'front', l: 'Front' },
                  { v: 'back', l: `Back${current.back.length ? '' : ' (empty)'}` },
                ]}
                onChange={setSideTab}
              />
              <ol aria-label={`${sideTab === 'front' ? 'Front' : 'Back'} blocks`} className="space-y-2">
                {blocks.map((b, i) => (
                  <li key={b.id} className="rounded-lg border border-line bg-ivory/60 p-2.5">
                    <div className="flex items-center gap-1">
                      <span className="flex-1 text-xs font-medium uppercase tracking-[0.15em] text-muted">{BLOCK_LABELS[b.kind]}</span>
                      <button type="button" aria-label={`Move ${BLOCK_LABELS[b.kind]} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1.5 text-muted hover:bg-cream disabled:opacity-30">
                        <ArrowUp aria-hidden="true" className="size-3.5" />
                      </button>
                      <button type="button" aria-label={`Move ${BLOCK_LABELS[b.kind]} down`} disabled={i === blocks.length - 1} onClick={() => move(i, 1)} className="rounded p-1.5 text-muted hover:bg-cream disabled:opacity-30">
                        <ArrowDown aria-hidden="true" className="size-3.5" />
                      </button>
                      <button type="button" aria-label={`Remove ${BLOCK_LABELS[b.kind]}`} onClick={() => setBlocks(blocks.filter((x) => x.id !== b.id))} className="rounded p-1.5 text-muted hover:bg-cream hover:text-rose">
                        <Trash2 aria-hidden="true" className="size-3.5" />
                      </button>
                    </div>
                    <BlockFields block={b} onChange={(p) => patch(b.id, p)} hasGift={Boolean(gift)} programCount={program?.filter((x) => x.title.trim()).length ?? null} verse={data.verse} />
                  </li>
                ))}
              </ol>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                Add
                <select
                  aria-label="Add a block"
                  className="input-base min-h-10 flex-1 py-1.5"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) setBlocks([...blocks, newBlock(e.target.value as BlockKind)])
                  }}
                >
                  <option value="">Choose what to add…</option>
                  {(Object.keys(BLOCK_LABELS) as BlockKind[]).map((k) => (
                    <option key={k} value={k}>
                      {BLOCK_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              {(fits.front.overflow || fits.back.overflow) && (
                <p role="alert" className="flex items-start gap-2 text-sm text-rose">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  The {fits.front.overflow ? 'front' : 'back'} is too full for this size — take something out, or choose a bigger leaflet.
                </p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={duplicate} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm text-ink-soft hover:bg-cream">
                  <Copy aria-hidden="true" className="size-3.5" /> Duplicate
                </button>
                <button type="button" onClick={() => setDeleting(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm text-rose hover:bg-rose/10">
                  <Trash2 aria-hidden="true" className="size-3.5" /> Delete
                </button>
              </div>
            </Panel>
            {hasBack && <DuplexPanel prefs={prefs} update={update} testing={testing} onTest={setTesting} />}
            <TipsFold title="Printing tips">
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Print at <strong>Actual size / 100%</strong> and cut along the corner marks.
                </li>
                <li>QR codes link to your live website, so they always show the latest details.</li>
                <li>“Program flow” and “Bible verse” come from Website Settings, so a change there shows here too.</li>
                <li>In your own list, put a time and a dash — “3:00 PM — Ceremony” — and the times line up on their own.</li>
              </ul>
            </TipsFold>
          </>
        )}
      </aside>
      </RibbonPane>
      <section aria-label="Print preview" className="min-w-0">
        {!current ? <EmptyPreview>Start a leaflet in the panel — from a ready-made one or blank — then change anything you like.</EmptyPreview> : <Sheets paper={paper} tint={fit.tint} sheets={sheets} />}
      </section>
      <ConfirmDialog
        destructive
        open={deleting}
        title="Delete this leaflet?"
        message={`“${current?.name ?? ''}” and its blocks will be removed. Nothing else changes.`}
        confirmLabel="Delete"
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          setDeleting(false)
          if (!current) return
          const rest = leaflets.filter((l) => l.id !== current.id)
          update({ leaflets: rest })
          setCurrentId(rest[0]?.id ?? null)
        }}
      />
    </div>
  )
}

function BlockFields({
  block: b,
  onChange,
  hasGift,
  programCount,
  verse,
}: {
  block: LeafletBlock
  onChange: (p: Partial<LeafletBlock>) => void
  hasGift: boolean
  programCount: number | null
  verse?: { text: string; reference: string }
}) {
  const label = BLOCK_LABELS[b.kind]
  switch (b.kind) {
    case 'heading':
    case 'hashtag':
      return <input aria-label={label} className="input-base mt-1.5 min-h-10 py-1.5" value={b.text} maxLength={80} onChange={(e) => onChange({ text: e.target.value })} />
    case 'text':
      return <textarea aria-label={label} className="input-base mt-1.5 min-h-20 py-2" value={b.text} maxLength={600} onChange={(e) => onChange({ text: e.target.value })} />
    case 'list':
      return (
        <div className="mt-1.5 space-y-1.5">
          <input aria-label="List title" className="input-base min-h-10 py-1.5" value={b.title} maxLength={40} placeholder="Title (optional)" onChange={(e) => onChange({ title: e.target.value })} />
          <textarea aria-label="List items" className="input-base min-h-28 py-2" value={b.text} maxLength={800} onChange={(e) => onChange({ text: e.target.value })} />
          <p className="text-xs text-muted">One per line. “3:00 PM — Ceremony” puts the time on the left.</p>
        </div>
      )
    case 'qr':
      return (
        <div className="mt-1.5 space-y-1.5">
          <select aria-label="QR code links to" className="input-base min-h-10 py-1.5" value={b.source} onChange={(e) => onChange({ source: e.target.value as QrSource })}>
            {(Object.keys(QR_SOURCES) as QrSource[]).map((k) => (
              <option key={k} value={k}>
                {QR_SOURCES[k]}
              </option>
            ))}
          </select>
          {b.source === 'custom' && <input aria-label="Link" className="input-base min-h-10 py-1.5" type="url" placeholder="https://…" value={b.url ?? ''} onChange={(e) => onChange({ url: e.target.value })} />}
          {b.source === 'gift' && !hasGift && <p className="text-xs text-rose">Upload your GCash / InstaPay QR in Website Settings first.</p>}
          <input aria-label="Caption under the QR" className="input-base min-h-10 py-1.5" value={b.caption} maxLength={50} placeholder="Caption (optional)" onChange={(e) => onChange({ caption: e.target.value })} />
        </div>
      )
    case 'program':
      return (
        <div className="mt-1.5 space-y-1.5">
          <input aria-label="Program title" className="input-base min-h-10 py-1.5" value={b.title} maxLength={40} placeholder="Title (optional)" onChange={(e) => onChange({ title: e.target.value })} />
          {programCount === 0 ? (
            <p className="text-xs text-rose">
              No program yet — add it in <Link to="/admin/settings" className="underline">Website Settings → Program flow</Link>.
            </p>
          ) : (
            <p className="text-xs text-muted">
              {programCount === null ? 'Loading your program…' : `${programCount} ${programCount === 1 ? 'moment' : 'moments'} from Website Settings → Program flow (prints even while hidden on the website).`}
            </p>
          )}
        </div>
      )
    case 'verse':
      return verse?.text.trim() ? (
        <p className="mt-1 text-xs text-muted">{verse.reference.trim() || 'Your verse'}, from Website Settings → Bible verse.</p>
      ) : (
        <p className="mt-1 text-xs text-rose">
          No verse yet — add it in <Link to="/admin/settings" className="underline">Website Settings → Bible verse</Link>.
        </p>
      )
    case 'names':
      return <p className="mt-1 text-xs text-muted">From Website Settings.</p>
    case 'details':
      return <p className="mt-1 text-xs text-muted">The venue and start time, from Website Settings.</p>
    case 'monogram':
      return <p className="mt-1 text-xs text-muted">Your monogram (Look & Feel).</p>
    default:
      return null
  }
}
