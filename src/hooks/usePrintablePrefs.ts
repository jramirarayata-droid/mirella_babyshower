import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteAdminPreference, getAdminPreference, saveAdminPreference } from '../services/preferencesService'
import type { CardSize, Paper } from '../utils/printables'
import type { StyleId } from '../theme/themes'
import { DEFAULT_PAPER_COLOUR, type PrintOn } from '../utils/paperColour'
import type { Leaflet } from '../utils/leaflets'
import type { EnvelopeFit, OurDetails, PaperMeasured } from '../utils/printables'
import type { CardShape } from '../utils/standPrintables'

/** Everything on the Printables page that's remembered between visits (not the guest selection). */
export interface PrintablePrefs {
  paper: Paper
  /** null = follow the website's design style. */
  design: StyleId | null
  /** As designed (background printed), or on coloured paper (no background, less ink). */
  printOn: PrintOn
  /** The coloured paper's colour — for the preview only, never printed. */
  paperColour: string
  size: CardSize
  qrPlace: 'back' | 'front'
  /** "Good to know" sections ticked for the back; null = the first three. */
  backIds: string[] | null
  /** Sections whose title prints in bold. */
  boldIds: string[]
  printSide: 'front' | 'back' | 'both'
  showPositions: boolean
  rotateBacks: boolean
  envelopeQr: boolean
  /** Details printed on the front (the rest re-centres when some are off). */
  showCeremony: boolean
  showReception: boolean
  showRespondBy: boolean
  showWithNames: boolean
  /** The entourage in the invitation set: not printed, as a separate card, or on the back of each invitation. */
  entourage: 'off' | 'insert' | 'back'
  /** Attire guide: everything on one card, or spread over cards (bigger photos). */
  attireLayout: 'one' | 'cards'
  /** Thank-you card wording. */
  thanksTitle: string
  thanksMessage: string
  thanksSign: string
  /** Name cards (folded stands): 2 or 4 per sheet; show the table; your names & date at the bottom. */
  nameCardsPer: 2 | 4
  nameCardsTable: boolean
  /** Extra name cards, one per line ("Name" or "Name | Table"). */
  nameCardsExtra: string
  /** Table names: flat cards (same on both sides) or folded stands. */
  tablesMode: 'flat' | 'stand'
  tablesFlatPer: 1 | 2 | 4
  tablesStandPer: 1 | 2
  /** Small line above each table's name, e.g. "Table" ('' = none). */
  tablesEyebrow: string
  /** Flat table cards: taller than wide, or wider than tall. */
  tablesShape: CardShape
  /** Seating-plan tables left out (ids). */
  tablesSkip: string[]
  /** More table names, one per line. */
  tablesExtra: string
  /** Two-sided printing: where the back lands, and the printer's measured offset (mm). */
  duplexMirror: boolean
  duplexDx: number
  duplexDy: number
  /** Leaflets you've made. */
  leaflets: Leaflet[]
  /** Your monogram, names and date on each printable (each can be switched off). */
  ours: Record<OursKey, OurDetails>
  /** Money envelope front: names always; the date, ceremony, reception and monogram seal can be left off. */
  envDate: boolean
  envCeremony: boolean
  envReception: boolean
  envSeal: boolean
  /** Your envelope (inside size, mm) and what goes in it — for the "Fits my envelope" card size. */
  envFit: EnvelopeFit
  /** "Good to know" wording changed for print only (by Website Settings section id) — the website keeps its own. */
  gtkEdits: Record<string, { title: string; body: string }>
  /** Your own "Good to know" sections, for print only. */
  gtkExtra: { id: string; title: string; body: string }[]
  /** Ceremony / reception lines on the invitation front, worded for print only (may use **bold**, *italic*, ==gold==). Missing = the website's. */
  frontText: { ceremony?: string; reception?: string }
  /** Your paper as measured (mm, short × long), when it isn't exactly its stated size — the design is centred on it. */
  paperMeasured: Partial<Record<Paper, PaperMeasured>>
  /** Print the design's border around each card (crop marks are printed either way). */
  cardBorder: boolean
  /** Attire guide: "Please refrain from wearing …" note at the bottom (items one per line or comma-separated). */
  attireAvoid: { on: boolean; title: string; items: string }
}

export type OursKey = 'invitations' | 'attire' | 'entourage' | 'thanks' | 'nameCards' | 'tables'
const ON = { monogram: true, names: true, date: true }
export const DEFAULT_OURS: Record<OursKey, OurDetails> = {
  invitations: ON,
  attire: ON,
  entourage: ON,
  thanks: ON,
  nameCards: { monogram: false, names: true, date: true },
  tables: { monogram: false, names: true, date: true },
}

export const DEFAULT_PRINTABLE_PREFS: PrintablePrefs = {
  paper: 'a4',
  design: null,
  printOn: 'designed',
  paperColour: DEFAULT_PAPER_COLOUR,
  size: '5x7',
  qrPlace: 'back',
  backIds: null,
  boldIds: [],
  printSide: 'front',
  showPositions: true,
  rotateBacks: false,
  envelopeQr: true,
  showCeremony: true,
  showReception: true,
  showRespondBy: true,
  showWithNames: true,
  entourage: 'off',
  attireLayout: 'one',
  thanksTitle: 'Thank you',
  thanksMessage:
    'Thank you for celebrating our wedding day with us. Your presence, your prayers and your kindness made the day truly special, and we will treasure the memories we shared with you.',
  thanksSign: 'With love and gratitude,',
  nameCardsPer: 2,
  nameCardsTable: true,
  nameCardsExtra: '',
  tablesMode: 'flat',
  tablesFlatPer: 2,
  tablesStandPer: 1,
  tablesEyebrow: '',
  tablesShape: 'upright',
  tablesSkip: [],
  tablesExtra: '',
  duplexMirror: true,
  duplexDx: 0,
  duplexDy: 0,
  leaflets: [],
  ours: DEFAULT_OURS,
  envDate: true,
  envCeremony: true,
  envReception: true,
  envSeal: true,
  envFit: { w: 127, h: 177.8, cards: 3, thick: 0.35 },
  gtkEdits: {},
  gtkExtra: [],
  frontText: {},
  paperMeasured: {},
  cardBorder: true,
  attireAvoid: { on: true, title: 'Please refrain from wearing', items: 'Slippers\nSando\nShorts\nAbove-the-knee skirts' },
}

const KEY = 'printables'
export type SaveState = 'loading' | 'idle' | 'saving' | 'saved' | 'error'

/**
 * Loads the saved Printables setup and saves every change shortly after it's made
 * (stored in the database, so it's the same on every device).
 */
export function usePrintablePrefs() {
  const [prefs, setPrefs] = useState<PrintablePrefs>(DEFAULT_PRINTABLE_PREFS)
  const [state, setState] = useState<SaveState>('loading')
  const timer = useRef<number | undefined>(undefined)
  const latest = useRef(prefs)

  useEffect(() => {
    let alive = true
    getAdminPreference<Partial<PrintablePrefs>>(KEY)
      .then((saved) => {
        if (!alive) return
        const next = { ...DEFAULT_PRINTABLE_PREFS, ...(saved ?? {}) }
        next.ours = { ...DEFAULT_OURS, ...(saved?.ours ?? {}) }
        latest.current = next
        setPrefs(next)
        setState(saved ? 'saved' : 'idle')
      })
      .catch(() => alive && setState('idle'))
    return () => {
      alive = false
      window.clearTimeout(timer.current)
    }
  }, [])

  const update = useCallback((patch: Partial<PrintablePrefs>) => {
    const next = { ...latest.current, ...patch }
    latest.current = next
    setPrefs(next)
    setState('saving')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      saveAdminPreference(KEY, latest.current)
        .then(() => setState('saved'))
        .catch(() => setState('error'))
    }, 700)
  }, [])

  const reset = useCallback(async () => {
    window.clearTimeout(timer.current)
    latest.current = DEFAULT_PRINTABLE_PREFS
    setPrefs(DEFAULT_PRINTABLE_PREFS)
    try {
      await deleteAdminPreference(KEY)
      setState('idle')
    } catch {
      setState('error')
    }
  }, [])

  return { prefs, update, reset, state }
}
