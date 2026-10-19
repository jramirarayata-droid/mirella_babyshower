import { supabase } from '../lib/supabase'
import { getAdminPreference, saveAdminPreference } from './preferencesService'
import { getDisplayPrefs } from './displayPrefsService'
import { FriendlyError, logError } from '../utils/errors'

/** Admin → Raffle settings (stored in admin preferences under "raffle"). */
export interface RaffleSettings {
  /** The public raffle page: hidden, visible, or visible from a date and time. */
  mode: 'hidden' | 'visible' | 'scheduled' | 'reveal'
  from: string | null
  /** Whose names are on the wheel. */
  pool: 'all' | 'groom' | 'bride'
  attendingOnly: boolean
  /** auto = names partly hidden until the wedding day; on / off = always / never. */
  mask: 'auto' | 'on' | 'off'
  removeWinners: boolean
  extraNames: string[]
  excluded: string[]
  /** first = the first name the wheel lands on wins; last = each spin knocks a name out, the last one left wins. */
  drawMode: 'first' | 'last'
  /** Last one standing: how many consolation prizes (2nd, 3rd …) before the winner. */
  consolations: number
  /** Prizes by place: [winner, 2nd, 3rd, …]. */
  prizes: string[]
  /** Last one standing: quick spins until this many names are left, then full spins. */
  finalsAt: number
}

export const DEFAULT_RAFFLE: RaffleSettings = {
  mode: 'hidden',
  from: null,
  pool: 'all',
  attendingOnly: false,
  mask: 'auto',
  removeWinners: true,
  extraNames: [],
  excluded: [],
  drawMode: 'first',
  consolations: 2,
  prizes: [],
  finalsAt: 5,
}

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d)

export async function getRaffleSettings(): Promise<RaffleSettings> {
  const v = (await getAdminPreference<Record<string, unknown>>('raffle')) ?? {}
  return {
    mode: pick(v.mode, ['hidden', 'visible', 'scheduled', 'reveal'] as const, 'hidden'),
    from: typeof v.from === 'string' && v.from ? v.from : null,
    pool: pick(v.pool, ['all', 'groom', 'bride'] as const, 'all'),
    attendingOnly: v.attendingOnly === true,
    mask: pick(v.mask, ['auto', 'on', 'off'] as const, 'auto'),
    removeWinners: v.removeWinners !== false,
    extraNames: strings(v.extraNames),
    excluded: strings(v.excluded),
    drawMode: pick(v.drawMode, ['first', 'last'] as const, 'first'),
    consolations: Math.min(10, Math.max(0, Math.round(Number(v.consolations ?? 2)) || 0)),
    prizes: Array.isArray(v.prizes) ? v.prizes.map((x) => (typeof x === 'string' ? x : '')) : [],
    finalsAt: Math.min(20, Math.max(2, Math.round(Number(v.finalsAt ?? 5)) || 5)),
  }
}

export async function saveRaffleSettings(s: RaffleSettings): Promise<void> {
  await saveAdminPreference('raffle', s)
  void getDisplayPrefs(true)
}

export interface PoolName {
  name: string
  side: 'groom' | 'bride'
  attending: boolean
}

/** Admin: everyone who could be on the wheel (invitees, included guests, approved extras). */
export async function getRafflePool(): Promise<PoolName[]> {
  const { data, error } = await supabase.rpc('raffle_pool')
  if (error) {
    logError('getRafflePool', error)
    throw new FriendlyError('We couldn’t load the guest names.')
  }
  const rows = (Array.isArray(data) ? data : []) as { name: string; side: string; attending: boolean }[]
  return rows.map((r) => ({ name: r.name, side: r.side === 'bride' ? 'bride' : 'groom', attending: Boolean(r.attending) }))
}

export interface RaffleDraw {
  id: string
  name: string
  prize: string | null
  /** 1 = winner, 2 / 3 … = consolation (last one standing); null = first-spin-wins. */
  place: number | null
  drawnAt: string
}

export async function getRaffleDraws(): Promise<RaffleDraw[]> {
  const { data, error } = await supabase.from('raffle_draws').select('id, name, prize, place, drawn_at').order('drawn_at', { ascending: false })
  if (error) {
    logError('getRaffleDraws', error)
    throw new FriendlyError('We couldn’t load the winners.')
  }
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, prize: r.prize, place: r.place ?? null, drawnAt: r.drawn_at }))
}

export async function addRaffleDraw(name: string, prize: string, place: number | null = null): Promise<RaffleDraw> {
  const { data, error } = await supabase
    .from('raffle_draws')
    .insert({ name: name.slice(0, 150), prize: prize.trim() ? prize.trim().slice(0, 150) : null, place })
    .select('id, name, prize, place, drawn_at')
    .single()
  if (error || !data) {
    logError('addRaffleDraw', error)
    throw new FriendlyError('The winner couldn’t be saved. Please write it down and try again.')
  }
  return { id: data.id, name: data.name, prize: data.prize, place: data.place ?? null, drawnAt: data.drawn_at }
}

export async function deleteRaffleDraw(id: string): Promise<void> {
  const { error } = await supabase.from('raffle_draws').delete().eq('id', id)
  if (error) {
    logError('deleteRaffleDraw', error)
    throw new FriendlyError('We couldn’t remove this winner. Please try again.')
  }
}

/** Public: the names for the raffle page (already masked by the server when needed). */
export async function getPublicWheel(): Promise<{ visible: boolean; masked: boolean; names: string[]; hostCode: boolean }> {
  const { data, error } = await supabase.rpc('raffle_wheel')
  if (error) {
    logError('getPublicWheel', error)
    throw new FriendlyError('The raffle couldn’t be loaded. Please try again.')
  }
  const o = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  return { visible: o.visible === true, masked: o.masked === true, names: strings(o.names), hostCode: o.hostCode === true }
}

const key = (n: string) => n.trim().toLowerCase()

/** The names on the wheel for the current settings (same rules as the public page). */
export function wheelNames(s: RaffleSettings, pool: PoolName[], draws: RaffleDraw[]): string[] {
  const excluded = new Set(s.excluded.map(key))
  // Last one standing: every new round starts with everyone, past winners too.
  const won = new Set(s.removeWinners && s.drawMode !== 'last' ? draws.map((d) => key(d.name)) : [])
  const seen = new Set<string>()
  const out: string[] = []
  const add = (n: string) => {
    const k = key(n)
    if (!k || seen.has(k) || excluded.has(k) || won.has(k)) return
    seen.add(k)
    out.push(n.trim())
  }
  for (const p of pool) if ((s.pool === 'all' || p.side === s.pool) && (!s.attendingOnly || p.attending)) add(p.name)
  for (const n of s.extraNames) add(n)
  return out.sort((a, b) => a.localeCompare(b))
}

/** "Rina Gaspar" → "R*** G*****" (same as the server). */
export function maskName(n: string): string {
  return n
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] + '*'.repeat(Math.max(Math.min(w.length - 1, 6), 2)))
    .join(' ')
}

/** Are names masked right now? auto = until the wedding day (Philippine time). */
export function namesMasked(mask: RaffleSettings['mask'], weddingDate: string | undefined): boolean {
  if (mask === 'on') return true
  if (mask === 'off') return false
  if (!weddingDate) return true
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return today < weddingDate
}

/** Last one standing: names knocked out in the current round (saved, so a refresh keeps the round). */
export async function getRaffleRound(): Promise<string[]> {
  const v = await getAdminPreference<{ eliminated?: unknown }>('raffle_round')
  return strings(v?.eliminated)
}

export async function saveRaffleRound(eliminated: string[]): Promise<void> {
  await saveAdminPreference('raffle_round', { eliminated })
}

/** "1st", "2nd", "3rd", "4th" … */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

// ---------------------------------------------------------------- host link (present on the website)

/** Admin: the private host link's code — 'get' (makes one if needed), 'new' (replaces it) or 'off'. */
export async function raffleHostToken(action: 'get' | 'new' | 'off'): Promise<string | null> {
  const { data, error } = await supabase.rpc('raffle_host_token', { p_action: action })
  if (error) {
    logError('raffleHostToken', error)
    throw new FriendlyError('The host link couldn’t be updated. Please try again.')
  }
  return typeof data === 'string' && data ? data : null
}

/** Admin: is a host link turned on? */
export async function raffleHostLinkOn(): Promise<boolean> {
  const { data, error } = await supabase.rpc('raffle_host_link_on')
  if (error) {
    logError('raffleHostLinkOn', error)
    return false
  }
  return data === true
}

export function raffleHostUrl(base: string, token: string): string {
  return `${base}#/raffle?host=${encodeURIComponent(token)}`
}

export interface HostWheelState {
  host: boolean
  visible: boolean
  masked: boolean
  drawMode: 'first' | 'last'
  consolations: number
  finalsAt: number
  prizes: string[]
  knockedOut: number
  /** k = a key for the name (saved results use the real name on the server); n = the name as shown. */
  names: { k: string; n: string }[]
}

/** Host (link or signed-in admin): what's needed to run the wheel. host = false for everyone else. */
export async function getHostWheel(token: string | null): Promise<HostWheelState> {
  const { data, error } = await supabase.rpc('raffle_host_state', { p_token: token ?? '' })
  if (error) {
    logError('getHostWheel', error)
    throw new FriendlyError('The raffle couldn’t be loaded. Please try again.')
  }
  const o = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  const names = Array.isArray(o.names)
    ? (o.names as unknown[]).flatMap((x) => {
        const r = x as Record<string, unknown>
        return typeof r?.k === 'string' && typeof r?.n === 'string' ? [{ k: r.k, n: r.n }] : []
      })
    : []
  return {
    host: o.host === true,
    visible: o.visible === true,
    masked: o.masked === true,
    drawMode: o.drawMode === 'last' ? 'last' : 'first',
    consolations: Number(o.consolations ?? 2) || 0,
    finalsAt: Number(o.finalsAt ?? 5) || 5,
    prizes: Array.isArray(o.prizes) ? o.prizes.map((x) => (typeof x === 'string' ? x : '')) : [],
    knockedOut: Number(o.knockedOut ?? 0) || 0,
    names,
  }
}

/** Present: names knocked out this round, and today's winners (in order; masked like the wheel). */
export interface HostBoard {
  out: string[]
  winners: { name: string; prize: string | null; place: number | null }[]
}

export async function getHostBoard(token: string | null): Promise<HostBoard> {
  const { data, error } = await supabase.rpc('raffle_host_board', { p_token: token ?? '' })
  if (error) {
    logError('getHostBoard', error)
    return { out: [], winners: [] }
  }
  const o = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  return {
    out: Array.isArray(o.out) ? o.out.filter((x): x is string => typeof x === 'string') : [],
    winners: Array.isArray(o.winners)
      ? o.winners.flatMap((x) => {
          const r = (x ?? {}) as Record<string, unknown>
          return typeof r.name === 'string' ? [{ name: r.name, prize: typeof r.prize === 'string' ? r.prize : null, place: typeof r.place === 'number' ? r.place : null }] : []
        })
      : [],
  }
}

export interface HostOutcome {
  tone: 'out' | 'place' | 'winner'
  title: string
  name: string
  detail?: string
  then?: HostOutcome
}

const toOutcome = (v: unknown): HostOutcome | undefined => {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  return {
    tone: o.tone === 'out' || o.tone === 'place' ? o.tone : 'winner',
    title: String(o.title ?? 'Winner'),
    name: String(o.name ?? ''),
    detail: typeof o.detail === 'string' && o.detail ? o.detail : undefined,
    then: toOutcome(o.then),
  }
}

/** Host: the wheel landed on this name — the server saves the result. */
export async function hostLanded(token: string | null, key: string, prize: string): Promise<HostOutcome> {
  const { data, error } = await supabase.rpc('raffle_host_land', { p_token: token ?? '', p_key: key, p_prize: prize })
  if (error) {
    logError('hostLanded', error)
    const m = error.message ?? ''
    throw new FriendlyError(
      m.includes('NOT_HOST')
        ? 'This host link no longer works. Ask the couple for the new one.'
        : m.includes('RAFFLE_HIDDEN')
          ? 'The raffle has been hidden on the website.'
          : m.includes('NAME_GONE')
            ? 'That name was just taken off the wheel. Please spin again.'
            : 'The result couldn’t be saved. Please write it down.',
    )
  }
  return toOutcome(data) ?? { tone: 'winner', title: 'Winner', name: '' }
}

/** Host: start a new "last one standing" round. */
export async function hostNewRound(token: string | null): Promise<void> {
  const { error } = await supabase.rpc('raffle_host_new_round', { p_token: token ?? '' })
  if (error) {
    logError('hostNewRound', error)
    throw new FriendlyError('A new round couldn’t be started. Please try again.')
  }
}

// ---------------------------------------------------------------- host code (4 digits)

export type CodeLogin = { ok: true; token: string } | { ok: false; reason: 'wrong' | 'locked' | 'off' | 'hidden'; left?: number; minutes?: number }

/** Public: the host types the 4-digit code; a correct code gives this tab host access for a day. */
export async function hostCodeLogin(pin: string): Promise<CodeLogin> {
  const { data, error } = await supabase.rpc('raffle_host_code_login', { p_pin: pin })
  if (error) {
    logError('hostCodeLogin', error)
    throw new FriendlyError('The code couldn’t be checked. Please try again.')
  }
  const o = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  if (o.ok === true && typeof o.token === 'string') return { ok: true, token: o.token }
  const reason = o.reason === 'locked' || o.reason === 'off' || o.reason === 'hidden' ? o.reason : 'wrong'
  return { ok: false, reason, left: typeof o.left === 'number' ? o.left : undefined, minutes: typeof o.minutes === 'number' ? o.minutes : undefined }
}

export interface HostAccess {
  link: boolean
  code: string | null
  lockedUntil: string | null
}

/** Admin: host link on/off, the code, and whether wrong tries have paused the code. */
export async function getHostAccess(): Promise<HostAccess> {
  const { data, error } = await supabase.rpc('raffle_host_status')
  if (error) {
    logError('getHostAccess', error)
    return { link: false, code: null, lockedUntil: null }
  }
  const o = data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {}
  return {
    link: o.link === true,
    code: typeof o.code === 'string' ? o.code : null,
    lockedUntil: typeof o.lockedUntil === 'string' ? o.lockedUntil : null,
  }
}

/** Admin: set the 4-digit code, or null to turn it off (signs out hosts who used the old code). */
export async function setHostCode(pin: string | null): Promise<void> {
  const { error } = await supabase.rpc('raffle_host_set_code', { p_pin: pin ?? '' })
  if (error) {
    logError('setHostCode', error)
    throw new FriendlyError(error.message?.includes('BAD_CODE') ? 'The code must be exactly 4 digits.' : 'The code couldn’t be saved. Please try again.')
  }
}

/** Host: choose how the wheel works — first spin wins, or last one standing. */
export async function hostSetMode(token: string | null, mode: 'first' | 'last'): Promise<void> {
  const { error } = await supabase.rpc('raffle_host_set_mode', { p_token: token ?? '', p_mode: mode })
  if (error) {
    logError('hostSetMode', error)
    throw new FriendlyError('The raffle type couldn’t be changed. Please try again.')
  }
}
