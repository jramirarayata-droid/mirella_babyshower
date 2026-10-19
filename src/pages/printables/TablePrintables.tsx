import { useEffect, useMemo, useState } from 'react'
import { Printer, Ruler, TriangleAlert } from 'lucide-react'
import { useAdminData } from '../../hooks/useAdminData'
import { useWeddingSettings } from '../../hooks/useWeddingSettings'
import type { PrintablePrefs } from '../../hooks/usePrintablePrefs'
import { listSeats, listTables } from '../../services/seatingService'
import type { SeatAssignment, SeatingTable } from '../../types/seating'
import type { StyleId } from '../../theme/themes'
import { formatWeddingDate, babyMonogram } from '../../utils/formatting'
import { useMonogram } from '../../hooks/useMonogram'
import { forPaper } from '../../utils/paperColour'
import { readTheme } from '../../utils/printTheme'
import { SHEETS, type OurDetails, type Paper } from '../../utils/printables'
import { useKept } from '../../hooks/useKept'
import { alignmentSheets, faceCardSvg, flatLayout, flatSheets, portraitPage, standSheets, type CardShape, type Duplex, type FaceText, type FlatPerSheet } from '../../utils/standPrintables'
import { Button } from '../../components/ui/Button'
import { EmptyPreview, GuestSearch, OurDetailsSwitches, Panel, PrintBar, RibbonGroup, RibbonPane, Segmented, Sheets, TipsFold, matches, printSummary } from '../../components/printables/PrintShared'
import { cn } from '../../components/ui/cn'

type Props = { paper: Paper; design: StyleId; prefs: PrintablePrefs; update: (patch: Partial<PrintablePrefs>) => void; onPortrait?: (portrait: boolean) => void }

/** The colours to print with (design style + coloured-paper setting). */
export function usePrintColours(design: StyleId, prefs: PrintablePrefs) {
  const { settings } = useWeddingSettings()
  return useMemo(() => forPaper({ ...readTheme(), style: design, frame: prefs.cardBorder !== false }, prefs.printOn, prefs.paperColour), [settings?.theme, design, prefs.printOn, prefs.paperColour, prefs.cardBorder])
}

/** Seating-plan tables and seats (empty when there's no plan yet). */
function useSeating() {
  const [tables, setTables] = useState<SeatingTable[]>([])
  const [seats, setSeats] = useState<SeatAssignment[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let alive = true
    Promise.all([listTables().catch(() => []), listSeats().catch(() => [])]).then(([t, s]) => {
      if (!alive) return
      setTables(t)
      setSeats(s)
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [])
  return { tables, seats, loaded }
}

/** "Sponsors" → "Table · Sponsors"; "Table 5" stays as it is. */
const tableLine = (name: string) => (/\btable\b/i.test(name) ? name : `Table · ${name}`)

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

/** Your names / date line and monogram for a face, following the "Our details" switches. */
function useOurs(d: OurDetails) {
  const { settings } = useWeddingSettings()
  const mono = useMonogram()
  const footer = [d.names ? settings?.babyName : '', d.date && settings ? formatWeddingDate(settings.weddingDate) : ''].filter(Boolean).join(' · ')
  const seal = d.monogram && settings ? { text: babyMonogram(settings.babyName), art: mono ? { src: mono.src, aspect: mono.aspect } : null } : undefined
  return { footer: footer || undefined, seal }
}

const PrintButton = ({ count, disabled }: { count: number; disabled?: boolean }) => (
  <Button className="sm:min-w-40" disabled={disabled || count === 0} onClick={() => window.print()} icon={<Printer aria-hidden="true" className="size-4" />}>
    Print {count} {count === 1 ? 'sheet' : 'sheets'}
  </Button>
)

// ---------------------------------------------------------------- name cards

interface Person {
  key: string
  name: string
  table: string | null
  party: string
}

export function NameCardsTab({ paper, design, prefs, update }: Props) {
  const { data } = useAdminData()
  const { tables, seats } = useSeating()
  const fit = usePrintColours(design, prefs)
  const ours = useOurs(prefs.ours.nameCards)
  const [showAll, setShowAll] = useState(false)
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useKept<Set<string>>('names-selected', new Set())

  const people = useMemo<Person[]>(() => {
    const tableName = new Map(tables.map((t) => [t.id, t.name]))
    const seatOf = new Map(seats.map((s) => [`${s.invitationId}:${s.guestId ?? 'self'}`, tableName.get(s.tableId) ?? null]))
    return (data?.invitations ?? [])
      .filter((i) => i.isActive && (showAll || i.status === 'attending'))
      .sort((a, b) => a.inviteeName.localeCompare(b.inviteeName))
      .flatMap((i) => [
        { key: `${i.id}:self`, name: i.inviteeName, table: seatOf.get(`${i.id}:self`) ?? i.tableNumber, party: i.inviteeName },
        ...i.guests
          .filter((g) => g.status !== 'declined' && g.guestName.trim())
          .map((g) => ({ key: `${i.id}:${g.id}`, name: g.guestName.trim(), table: seatOf.get(`${i.id}:${g.id}`) ?? i.tableNumber, party: i.inviteeName })),
      ])
  }, [data, tables, seats, showAll])

  const shown = filter.trim() ? people.filter((p) => matches(filter, p.name, p.party, p.table)) : people
  const extra = lines(prefs.nameCardsExtra).map((l) => {
    const [name, table] = l.split('|').map((x) => x.trim())
    return { name, table: table || null }
  })
  const chosen = [...people.filter((p) => selected.has(p.key)), ...extra]
  const faces: FaceText[] = chosen.map((p) => ({
    title: p.name,
    sub: prefs.nameCardsTable && p.table ? tableLine(p.table) : undefined,
    footer: ours.footer,
    seal: ours.seal,
  }))
  const sheets = standSheets(faces, paper, prefs.nameCardsPer, fit.theme, design)
  const toggle = (k: string) =>
    setSelected((cur) => {
      const n = new Set(cur)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  return (
    <div className="min-w-0">
      <PrintBar summary={faces.length ? printSummary([`${faces.length} ${faces.length === 1 ? 'name card' : 'name cards'}`, `${sheets.length} ${sheets.length === 1 ? 'sheet' : 'sheets'}`, SHEETS[paper].name, 'one side']) : 'No names yet — tick guests in the list or type names'}>
        <PrintButton count={sheets.length} />
      </PrintBar>
      <RibbonPane pane="content">
        <RibbonGroup label="Stands" className="w-72">
          <Segmented<2 | 4>
            label="Stands per sheet"
            value={prefs.nameCardsPer}
            options={[
              { v: 2, l: '2 (half sheet each)' },
              { v: 4, l: '4 (smaller)' },
            ]}
            onChange={(v) => update({ nameCardsPer: v })}
          />
          <label className="flex items-center justify-between gap-2 text-sm text-ink-soft">
            Show the guest’s table
            <input type="checkbox" checked={prefs.nameCardsTable} onChange={(e) => update({ nameCardsTable: e.target.checked })} className="size-5 accent-ink" />
          </label>
        </RibbonGroup>
      </RibbonPane>
      <RibbonPane pane="details">
        <RibbonGroup label="Our details" className="w-72">
          <OurDetailsSwitches value={prefs.ours.nameCards} onChange={(v) => update({ ours: { ...prefs.ours, nameCards: v } })} note="The monogram goes above the name; names and date along the bottom." />
        </RibbonGroup>
      </RibbonPane>
      <RibbonPane pane="side">
      <aside className="space-y-4 print:hidden">
        <Panel label="Guests">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-ink-soft">{showAll ? 'Everyone invited' : 'Attending guests'}</p>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-ink" /> Show everyone
            </label>
          </div>
          <GuestSearch value={filter} onChange={setFilter} count={shown.length} total={people.length} />
          <div className="flex gap-2 text-xs">
            <button type="button" className="rounded-md bg-cream px-2.5 py-1.5 hover:bg-linen" onClick={() => setSelected(new Set([...selected, ...shown.map((p) => p.key)]))}>
              Select {filter.trim() ? 'these' : 'all'}
            </button>
            <button type="button" className="rounded-md px-2.5 py-1.5 text-muted hover:bg-cream" onClick={() => setSelected(new Set())}>
              Clear
            </button>
            <span className="ml-auto self-center text-muted">{selected.size} ticked</span>
          </div>
          {!data ? (
            <p className="py-4 text-center text-sm text-muted">Loading guests…</p>
          ) : shown.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">{showAll || filter ? 'No one matches.' : 'No one has confirmed yet — tick “Show everyone”.'}</p>
          ) : (
            <ul aria-label="Guests" className="max-h-[50vh] divide-y divide-line overflow-y-auto">
              {shown.map((p) => (
                <li key={p.key}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 text-sm hover:bg-cream/60">
                    <input type="checkbox" className="size-4 accent-ink" checked={selected.has(p.key)} onChange={() => toggle(p.key)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ink">{p.name}</span>
                      {p.party !== p.name && <span className="block truncate text-xs text-muted">with {p.party}</span>}
                    </span>
                    {p.table && <span className="shrink-0 truncate text-xs text-muted">{p.table}</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <label className="block text-sm text-ink-soft">
            More names
            <textarea
              className="input-base mt-1.5 min-h-20 py-2"
              value={prefs.nameCardsExtra}
              placeholder={'One per line — e.g.\nLola Nena\nFr. Ramon | Sponsors'}
              onChange={(e) => update({ nameCardsExtra: e.target.value })}
            />
            <span className="mt-1 block text-xs text-muted">Add “| table” after a name to show its table.</span>
          </label>
        </Panel>
        <TipsFold title="Making the stands">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Print at <strong>Actual size / 100%</strong>, one side only, on card stock (200 gsm or more).
            </li>
            <li>Cut along the dashed line{prefs.nameCardsPer === 4 ? 's' : ''} through the middle — the sheet’s edges are already the stand’s edges.</li>
            <li>Fold along the three dashed lines into a triangle, with the names outside.</li>
            <li>Glue the small tab under the base (or use tape). The name reads the right way up on both sides of the table.</li>
          </ol>
          <p className="mt-2 text-xs text-muted">Tables come from Seating (or the invitation’s table). Names are printed as each guest’s own name.</p>
        </TipsFold>
      </aside>
      </RibbonPane>
      <section aria-label="Print preview" className="min-w-0">
        {faces.length === 0 ? <EmptyPreview>Tick guests in the list (or type names) to preview their name cards.</EmptyPreview> : <Sheets paper={paper} tint={fit.tint} sheets={sheets} />}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- two-sided printing setup

export function DuplexPanel({
  prefs,
  update,
  testing,
  onTest,
  showMirror = true,
}: {
  prefs: PrintablePrefs
  update: (patch: Partial<PrintablePrefs>) => void
  testing: boolean
  onTest: (on: boolean) => void
  /** Cards that print the same on both sides can land mirrored or straight behind; invitations always flip on the long edge. */
  showMirror?: boolean
}) {
  const num = (v: string) => Math.max(-20, Math.min(20, Math.round((Number(v) || 0) * 10) / 10))
  return (
    <>
      <RibbonGroup label="Lining up both sides" className="w-80">
        <p className="flex items-start gap-2 text-xs text-ink-soft">
          <Ruler aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-gold" />
          Print the line-up test once, the same way you’ll print, then set these from what it shows. One setting for all printables.
        </p>
        {showMirror && (
        <Segmented<'mirror' | 'same'>
          label="Back lands"
          value={prefs.duplexMirror ? 'mirror' : 'same'}
          options={[
            { v: 'mirror', l: 'Mirrored (flip ↔)' },
            { v: 'same', l: 'Straight behind' },
          ]}
          onChange={(v) => update({ duplexMirror: v === 'mirror' })}
        />
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-ink-soft">
            Move back → (mm)
            <input type="number" step={0.1} className="input-base mt-1 min-h-9 py-1" value={prefs.duplexDx} onChange={(e) => update({ duplexDx: num(e.target.value) })} />
          </label>
          <label className="block text-xs text-ink-soft">
            Move back ↓ (mm)
            <input type="number" step={0.1} className="input-base mt-1 min-h-9 py-1" value={prefs.duplexDy} onChange={(e) => update({ duplexDy: num(e.target.value) })} />
          </label>
        </div>
      </RibbonGroup>
      <RibbonGroup label="Line-up test" className="w-56">
        <p className="text-xs text-muted">
          Hold the test up to a light and read where the front’s cross falls on the back’s rulers (minus = left / up). Add that to the numbers here, then test again until the cross sits on 0. Saved for next time.
        </p>
        <button
          type="button"
          onClick={() => onTest(!testing)}
          className={cn('min-h-10 w-full rounded-full border px-4 text-sm transition', testing ? 'border-ink bg-ink text-ivory' : 'border-line text-ink hover:bg-cream')}
        >
          {testing ? 'Back to the cards' : 'Show the line-up test'}
        </button>
        {Math.abs(prefs.duplexDx) + Math.abs(prefs.duplexDy) > 8 && (
          <p role="alert" className="flex items-start gap-1.5 text-xs text-rose">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            That’s a big shift — check the test again.
          </p>
        )}
      </RibbonGroup>
    </>
  )
}

// ---------------------------------------------------------------- table names

export function TableNamesTab({ paper, design, prefs, update, onPortrait }: Props) {
  const { tables, loaded } = useSeating()
  const fit = usePrintColours(design, prefs)
  const ours = useOurs(prefs.ours.tables)
  const [copies, setCopies] = useState(1)
  const [side, setSide] = useState<'front' | 'back' | 'both'>('both')
  const [testing, setTesting] = useState(false)
  const skip = new Set(prefs.tablesSkip)
  const names = [...tables.filter((t) => !skip.has(t.id)).map((t) => t.name.trim()), ...lines(prefs.tablesExtra)].filter(Boolean)
  const faces: FaceText[] = names.flatMap((n) => Array.from({ length: copies }, () => ({ eyebrow: prefs.tablesEyebrow.trim() || undefined, title: n, footer: ours.footer, seal: ours.seal })))
  const duplex: Duplex = { mirror: prefs.duplexMirror, dx: prefs.duplexDx, dy: prefs.duplexDy }
  const flat = prefs.tablesMode === 'flat'
  const per = prefs.tablesFlatPer as FlatPerSheet
  const shape: CardShape = prefs.tablesShape ?? 'upright'
  // The page turns upright when the cards' shape needs it (and the print dialog follows).
  const portrait = flat && portraitPage(per, shape)
  useEffect(() => {
    onPortrait?.(portrait)
  }, [portrait, onPortrait])
  useEffect(() => () => onPortrait?.(false), [onPortrait])
  const { w, h } = flatLayout(paper, per, portrait)
  const sheets = testing
    ? alignmentSheets(paper, fit.theme, duplex, portrait)
    : flat
      ? flatSheets(
          faces.map((f) => faceCardSvg(f, w, h, fit.theme, design)),
          null,
          paper,
          per,
          fit.theme,
          duplex,
          side,
          portrait,
        )
      : standSheets(faces, paper, prefs.tablesStandPer, fit.theme, design)
  const toggle = (id: string) => update({ tablesSkip: skip.has(id) ? prefs.tablesSkip.filter((x) => x !== id) : [...prefs.tablesSkip, id] })

  return (
    <div className="min-w-0">
      <PrintBar
        summary={
          testing
            ? printSummary(['Line-up test', `${sheets.length} ${sheets.length === 1 ? 'page' : 'pages'}`, SHEETS[paper].name])
            : faces.length
              ? printSummary([`${faces.length} ${faces.length === 1 ? 'table name' : 'table names'}`, `${sheets.length} ${sheets.length === 1 ? 'sheet' : 'sheets'}`, SHEETS[paper].name])
              : 'No tables chosen yet'
        }
      >
        {flat && (
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <span className="sr-only">Print</span>
            <select aria-label="What to print" className="input-base min-h-10 w-auto py-1.5" value={side} onChange={(e) => setSide(e.target.value as typeof side)}>
              <option value="both">Both sides</option>
              <option value="front">Fronts</option>
              <option value="back">Backs</option>
            </select>
          </label>
        )}
        <PrintButton count={sheets.length} disabled={!testing && faces.length === 0} />
      </PrintBar>
      <RibbonPane pane="content">
        <RibbonGroup label="Style" className="w-72">
          <Segmented<'flat' | 'stand'>
            label="Style"
            value={prefs.tablesMode}
            options={[
              { v: 'flat', l: 'Flat card, both sides' },
              { v: 'stand', l: 'Folded stand' },
            ]}
            onChange={(v) => {
              setTesting(false)
              update({ tablesMode: v })
            }}
          />
          {!flat && (
            <Segmented<1 | 2>
              label="Stand size"
              value={prefs.tablesStandPer}
              options={[
                { v: 1, l: 'Big — 1 per sheet' },
                { v: 2, l: 'Smaller — 2 per sheet' },
              ]}
              onChange={(v) => update({ tablesStandPer: v })}
            />
          )}
        </RibbonGroup>
        {flat && (
          <RibbonGroup label="Cards" className="w-80">
            <Segmented<1 | 2 | 4>
              label="Cards per sheet"
              value={prefs.tablesFlatPer}
              options={[
                { v: 1, l: '1 (largest)' },
                { v: 2, l: '2' },
                { v: 4, l: '4' },
              ]}
              onChange={(v) => update({ tablesFlatPer: v })}
            />
            <Segmented<CardShape>
              label="Card shape"
              value={shape}
              options={[
                { v: 'upright', l: 'Upright ▯' },
                { v: 'sideways', l: 'Sideways ▭' },
              ]}
              onChange={(v) => update({ tablesShape: v })}
            />
            <p className="text-xs text-muted">
              Each card is {Math.round(w / 10)} × {Math.round(h / 10)} cm ({w > h ? 'wide' : 'tall'}); the name sizes itself to fit.{portrait ? ' The page prints upright (portrait).' : ''}
            </p>
          </RibbonGroup>
        )}
        <RibbonGroup label="Wording" className="w-64">
          <label className="block text-sm text-ink-soft">
            Small line above the name
            <input className="input-base mt-1.5 min-h-9 py-1" value={prefs.tablesEyebrow} maxLength={30} placeholder="e.g. Table — or leave empty" onChange={(e) => update({ tablesEyebrow: e.target.value })} />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-ink-soft">
            Copies of each
            <input type="number" min={1} max={6} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(6, Math.trunc(Number(e.target.value) || 1))))} className="input-base min-h-9 w-20 py-1" />
          </label>
        </RibbonGroup>
      </RibbonPane>
      <RibbonPane pane="details">
        <RibbonGroup label="Our details" className="w-72">
          <OurDetailsSwitches value={prefs.ours.tables} onChange={(v) => update({ ours: { ...prefs.ours, tables: v } })} />
        </RibbonGroup>
      </RibbonPane>
      {flat && (
        <RibbonPane pane="print">
          <DuplexPanel prefs={prefs} update={update} testing={testing} onTest={setTesting} />
        </RibbonPane>
      )}
      <RibbonPane pane="side">
      <aside className="space-y-4 print:hidden">
        <Panel label="Tables">
          <p className="text-sm text-ink-soft">From your seating plan</p>
          {!loaded ? (
            <p className="text-sm text-muted">Loading tables…</p>
          ) : tables.length === 0 ? (
            <p className="text-sm text-muted">No tables in Seating yet — type the names below.</p>
          ) : (
            <>
              <div className="flex gap-2 text-xs">
                <button type="button" className="rounded-md bg-cream px-2.5 py-1.5 hover:bg-linen" onClick={() => update({ tablesSkip: [] })}>
                  Select all
                </button>
                <button type="button" className="rounded-md px-2.5 py-1.5 text-muted hover:bg-cream" onClick={() => update({ tablesSkip: tables.map((t) => t.id) })}>
                  Clear
                </button>
              </div>
              <ul className="max-h-[40vh] divide-y divide-line overflow-y-auto">
                {tables.map((t) => (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 text-sm hover:bg-cream/60">
                      <input type="checkbox" className="size-4 accent-ink" checked={!skip.has(t.id)} onChange={() => toggle(t.id)} />
                      <span className="min-w-0 flex-1 truncate text-ink">{t.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
          <label className="block text-sm text-ink-soft">
            More table names
            <textarea className="input-base mt-1.5 min-h-20 py-2" value={prefs.tablesExtra} placeholder={'One per line — as many as you like'} onChange={(e) => update({ tablesExtra: e.target.value })} />
          </label>
        </Panel>
        <TipsFold title={flat ? 'Printing on both sides' : 'Making the stands'}>
          {flat ? (
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Two-sided printer:</strong> choose <em>Both sides</em> (Print tab) and two-sided in the print dialog.
              </li>
              <li>
                <strong>One side at a time:</strong> print <em>Fronts</em>, put the pages back turned over (in the same order), then print <em>Backs</em>.
              </li>
              <li>Do the line-up test first (Print tab) — then the back of every card lands right behind its front. Cut along the corner marks.</li>
            </ul>
          ) : (
            <ul className="list-disc space-y-1 pl-5">
              <li>One side only — the stand shows the name on both sides of the table. Use card stock (200 gsm or more).</li>
              <li>{prefs.tablesStandPer === 2 ? 'Cut along the dashed middle line, then fold' : 'Fold'} along the dashed lines into a triangle and glue the tab under the base.</li>
            </ul>
          )}
        </TipsFold>
      </aside>
      </RibbonPane>
      <section aria-label="Print preview" className="min-w-0">
        {!testing && faces.length === 0 ? <EmptyPreview>Pick tables in the panel (or type their names) to preview them.</EmptyPreview> : <Sheets paper={paper} portrait={portrait} tint={fit.tint} sheets={sheets} />}
      </section>
    </div>
  )
}
