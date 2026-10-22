import { supabase } from '../lib/supabase'
import { FriendlyError, logError } from '../utils/errors'
import { rememberGuest } from '../utils/guestIdentity'
import { getAdminPreference, saveAdminPreference } from './preferencesService'
import { savedGuest, type PhotoGuest } from './guestPhotosService'
import { GALLERY_LAYOUTS, type GalleryLayout } from '../types/wedding'

/*
 * The baby shower's own features: the gift wishlist ("I'll bring this"), the
 * gender reveal, the baby predictions game and name ideas from guests.
 * Guests identify themselves once (the same session as photo sharing);
 * everything that matters is checked again by the database.
 * Migrations 042–045.
 */

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null)
const NEEDS = 'This needs the new database update first (migrations 042–045).'
const missing = (e: { message?: string; code?: string } | null) => Boolean(e && (e.code === 'PGRST202' || e.code === '42883' || e.code === '42P01' || /does not exist|could not find/i.test(e.message ?? '')))

function fail(context: string, error: unknown, message: string): never {
  logError(context, error)
  throw new FriendlyError(missing(error as { message?: string }) ? NEEDS : message)
}

/** Which timing a guest feature follows (same as the raffle and photos). */
export type Visibility = 'hidden' | 'visible' | 'scheduled' | 'reveal'
const visibility = (v: unknown): Visibility => (v === 'visible' || v === 'scheduled' || v === 'reveal' ? v : 'hidden')

// ---------------------------------------------------------------- the guest pass

export type ShowerGuest = PhotoGuest
export const currentShowerGuest = (): ShowerGuest | null => savedGuest()

/** The guest types their full name, as on their invitation. */
export async function startShowerGuest(name: string): Promise<{ ok: true; guest: ShowerGuest } | { ok: false }> {
  const { data, error } = await supabase.rpc('shower_guest_start', { p_name: name })
  if (error) fail('startShowerGuest', error, 'We couldn’t check your name. Please try again.')
  const o = obj(data)
  if (o.ok !== true || typeof o.token !== 'string') return { ok: false }
  const guest = { token: o.token, name: str(o.name) || name }
  // Remember the person first (it clears another person's session), then keep this one.
  rememberGuest({ name: guest.name })
  try {
    localStorage.setItem('wedding-photo-guest', JSON.stringify(guest))
  } catch {
    /* private mode: works for this visit */
  }
  return { ok: true, guest }
}

// ---------------------------------------------------------------- gift wishlist

/** gift = something to bring ("I'll bring this"); idea = inspiration only (photo, title, caption). */
export type RegistryKind = 'gift' | 'idea'

export interface RegistryItem {
  id: string
  kind: RegistryKind
  title: string
  note: string
  link: string
  image: string
  price: string
  quantity: number
  claimed: number
  mine: number
}

export interface RegistryView {
  visible: boolean
  /** Kept for attending guests: true until this guest has RSVP'd "attending". */
  private: boolean
  /** What this visitor would see as a guest — the home page and menu follow this, even for signed-in admins. */
  guestVisible: boolean
  title: string
  intro: string
  me: string | null
  items: RegistryItem[]
}

const toItem = (x: unknown): RegistryItem => {
  const r = obj(x)
  return {
    id: str(r.id),
    kind: r.kind === 'idea' ? 'idea' : 'gift',
    title: str(r.title),
    note: str(r.note),
    link: str(r.link),
    image: str(r.image),
    price: str(r.price),
    quantity: num(r.quantity) ?? 1,
    claimed: num(r.claimed) ?? 0,
    mine: num(r.mine) ?? 0,
  }
}

export async function getRegistry(token?: string | null): Promise<RegistryView> {
  const { data, error } = await supabase.rpc('registry_list', { p_token: token ?? null })
  if (error) fail('getRegistry', error, 'The wishlist couldn’t be loaded. Please try again.')
  const o = obj(data)
  return {
    visible: o.visible === true,
    private: o.private === true,
    // Before database update 050 there is no guestVisible: fall back to the old reading.
    guestVisible: typeof o.guestVisible === 'boolean' ? o.guestVisible : o.visible === true && o.private !== true,
    title: str(o.title) || 'Gift Wishlist',
    intro: str(o.intro),
    me: str(o.me) || null,
    items: arr(o.items).map(toItem),
  }
}

export type ClaimResult = { ok: true } | { ok: false; reason: 'taken' | 'closed' | 'who' | 'gone' | 'private'; left?: number }

export async function claimRegistryItem(token: string, itemId: string, qty = 1): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc('registry_claim', { p_token: token, p_item: itemId, p_qty: qty })
  if (error) fail('claimRegistryItem', error, 'That didn’t save. Please try again.')
  const o = obj(data)
  if (o.ok === true) return { ok: true }
  const reason = o.reason === 'taken' || o.reason === 'closed' || o.reason === 'who' || o.reason === 'private' ? o.reason : 'gone'
  return { ok: false, reason, left: num(o.left) ?? undefined }
}

export async function unclaimRegistryItem(token: string, itemId: string): Promise<void> {
  const { error } = await supabase.rpc('registry_unclaim', { p_token: token, p_item: itemId })
  if (error) fail('unclaimRegistryItem', error, 'That didn’t save. Please try again.')
}

/** What this visitor may see: parts kept for attending guests, and whether they are one. */
export interface GuestAccess {
  wishlistPrivate: boolean
  attirePrivate: boolean
  attending: boolean
}

export async function getGuestAccess(token?: string | null): Promise<GuestAccess> {
  const { data, error } = await supabase.rpc('guest_access', { p_token: token ?? null })
  if (error) {
    logError('getGuestAccess', error)
    return { wishlistPrivate: false, attirePrivate: false, attending: false }
  }
  const o = obj(data)
  return { wishlistPrivate: o.wishlistPrivate === true, attirePrivate: o.attirePrivate === true, attending: o.attending === true }
}

// gift ideas (their own section on the home page)

/** 'cards' = photo cards with title and caption; the rest are the photo gallery designs. */
export type IdeasLayout = 'cards' | GalleryLayout
export const IDEAS_LAYOUTS: { id: IdeasLayout; name: string; description: string }[] = [
  { id: 'cards', name: 'Idea cards', description: 'Photo, title and caption on soft cards' },
  ...GALLERY_LAYOUTS,
]
const ideasLayout = (v: unknown): IdeasLayout => (IDEAS_LAYOUTS.some((l) => l.id === v) ? (v as IdeasLayout) : 'cards')

export interface GiftIdea {
  id: string
  title: string
  note: string
  link: string
  image: string
}
export interface GiftIdeasView {
  visible: boolean
  /** Kept for attending guests and this visitor isn't one (yet). */
  private: boolean
  title: string
  intro: string
  layout: IdeasLayout
  items: GiftIdea[]
}
const NO_IDEAS: GiftIdeasView = { visible: false, private: false, title: '', intro: '', layout: 'cards', items: [] }

/** The Gift ideas section, as a guest sees it. Never throws: on any problem the section is simply left out. */
export async function getGiftIdeas(token?: string | null): Promise<GiftIdeasView> {
  const { data, error } = await supabase.rpc('gift_ideas_list', { p_token: token ?? null })
  if (error) {
    logError('getGiftIdeas', error)
    return NO_IDEAS
  }
  const o = obj(data)
  return {
    visible: o.visible === true,
    private: o.private === true,
    title: str(o.title) || 'Gift Ideas',
    intro: str(o.intro),
    layout: ideasLayout(o.layout),
    items: arr(o.items)
      .map((x) => {
        const r = obj(x)
        return { id: str(r.id), title: str(r.title), note: str(r.note), link: str(r.link), image: str(r.image) }
      })
      .filter((i) => i.id && i.image),
  }
}

/** Which "Just for you" links the RSVP confirmation offers (each on unless switched off). */
export interface RsvpExtras {
  wishlist: boolean
  ideas: boolean
  attire: boolean
}
const ALL_EXTRAS: RsvpExtras = { wishlist: true, ideas: true, attire: true }
const readExtras = (v: unknown): RsvpExtras => {
  const o = obj(v)
  return { wishlist: o.wishlist !== false, ideas: o.ideas !== false, attire: o.attire !== false }
}

/** Guests: never throws (before database update 054 everything stays on, as before). */
export async function getRsvpExtras(): Promise<RsvpExtras> {
  const { data, error } = await supabase.rpc('rsvp_extras')
  if (error) {
    logError('getRsvpExtras', error)
    return ALL_EXTRAS
  }
  return readExtras(data)
}

/** Admin: switch one link on or off (reads the latest first, so other switches aren't undone). */
export async function saveRsvpExtra(what: keyof RsvpExtras, on: boolean): Promise<RsvpExtras> {
  const next = { ...readExtras(await getAdminPreference('rsvp_extras')), [what]: on }
  await saveAdminPreference('rsvp_extras', next)
  return next
}
export const getRsvpExtrasAdmin = async (): Promise<RsvpExtras> => readExtras(await getAdminPreference('rsvp_extras'))

export interface GiftIdeasSettings {
  visible: boolean
  title: string
  intro: string
  layout: IdeasLayout
}
export const DEFAULT_GIFT_IDEAS: GiftIdeasSettings = { visible: true, title: 'Gift Ideas', intro: '', layout: 'cards' }

export async function getGiftIdeasSettings(): Promise<GiftIdeasSettings> {
  const v = obj(await getAdminPreference('gift_ideas'))
  return { visible: v.visible !== false, title: str(v.title) || DEFAULT_GIFT_IDEAS.title, intro: str(v.intro), layout: ideasLayout(v.layout) }
}
export const saveGiftIdeasSettings = (s: GiftIdeasSettings) =>
  saveAdminPreference('gift_ideas', { visible: s.visible, title: s.title.trim().slice(0, 80), intro: s.intro.trim().slice(0, 300), layout: s.layout })

// admin

export interface RegistrySettings {
  mode: Visibility
  from: string | null
  title: string
  intro: string
}
export const DEFAULT_REGISTRY: RegistrySettings = { mode: 'visible', from: null, title: 'Gift Wishlist', intro: '' }

export async function getRegistrySettings(): Promise<RegistrySettings> {
  const v = obj(await getAdminPreference('registry'))
  return { mode: v.mode === undefined ? DEFAULT_REGISTRY.mode : visibility(v.mode), from: str(v.from) || null, title: str(v.title) || DEFAULT_REGISTRY.title, intro: str(v.intro) }
}
export const saveRegistrySettings = (s: RegistrySettings) => saveAdminPreference('registry', s)

export interface AdminRegistryItem {
  id: string
  kind: RegistryKind
  title: string
  note: string
  link: string
  imageUrl: string
  priceHint: string
  quantity: number
  sortOrder: number
  isVisible: boolean
  claims: { id: string; name: string; qty: number; at: string }[]
}

export async function listRegistryAdmin(): Promise<AdminRegistryItem[]> {
  const [items, claims] = await Promise.all([
    supabase.from('registry_items').select('*').order('sort_order').order('created_at'),
    supabase.from('registry_claims').select('*').order('created_at'),
  ])
  if (items.error) fail('listRegistryAdmin', items.error, 'The wishlist couldn’t be loaded.')
  if (claims.error) fail('listRegistryAdmin:claims', claims.error, 'The wishlist couldn’t be loaded.')
  const byItem = new Map<string, AdminRegistryItem['claims']>()
  for (const c of (claims.data ?? []) as Record<string, unknown>[]) {
    const list = byItem.get(str(c.item_id)) ?? []
    list.push({ id: str(c.id), name: str(c.name), qty: num(c.qty) ?? 1, at: str(c.created_at) })
    byItem.set(str(c.item_id), list)
  }
  return ((items.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: str(r.id),
    kind: r.kind === 'idea' ? 'idea' : 'gift',
    title: str(r.title),
    note: str(r.note),
    link: str(r.link),
    imageUrl: str(r.image_url),
    priceHint: str(r.price_hint),
    quantity: num(r.quantity) ?? 1,
    sortOrder: num(r.sort_order) ?? 0,
    isVisible: r.is_visible !== false,
    claims: byItem.get(str(r.id)) ?? [],
  }))
}

export type RegistryItemInput = Pick<AdminRegistryItem, 'kind' | 'title' | 'note' | 'link' | 'imageUrl' | 'priceHint' | 'quantity' | 'isVisible'>

const itemRow = (i: RegistryItemInput) => ({
  kind: i.kind,
  title: i.title.trim().slice(0, 120),
  note: i.note.trim().slice(0, 300) || null,
  link: i.link.trim() || null,
  image_url: i.imageUrl.trim() || null,
  price_hint: i.priceHint.trim().slice(0, 40) || null,
  quantity: Math.max(1, Math.min(99, Math.round(i.quantity) || 1)),
  is_visible: i.isVisible,
})

export async function addRegistryItem(i: RegistryItemInput, sortOrder: number): Promise<void> {
  const { error } = await supabase.from('registry_items').insert({ ...itemRow(i), sort_order: sortOrder })
  if (error) fail('addRegistryItem', error, 'The item couldn’t be added. Please check the links start with https://.')
}
export async function updateRegistryItem(id: string, i: RegistryItemInput): Promise<void> {
  const { error } = await supabase.from('registry_items').update(itemRow(i)).eq('id', id)
  if (error) fail('updateRegistryItem', error, 'The item couldn’t be saved. Please check the links start with https://.')
}
export async function deleteRegistryItem(id: string): Promise<void> {
  const { error } = await supabase.from('registry_items').delete().eq('id', id)
  if (error) fail('deleteRegistryItem', error, 'The item couldn’t be removed.')
}
export async function reorderRegistry(ids: string[]): Promise<void> {
  const results = await Promise.all(ids.map((id, i) => supabase.from('registry_items').update({ sort_order: i }).eq('id', id)))
  const bad = results.find((r) => r.error)
  if (bad?.error) fail('reorderRegistry', bad.error, 'The new order couldn’t be saved.')
}
export async function removeRegistryClaim(id: string): Promise<void> {
  const { error } = await supabase.from('registry_claims').delete().eq('id', id)
  if (error) fail('removeRegistryClaim', error, 'The claim couldn’t be removed.')
}

// ---------------------------------------------------------------- gender reveal

export type RevealAnswer = 'girl' | 'boy' | 'twin_girls' | 'twin_boys' | 'twins'

export interface PublicReveal {
  enabled: boolean
  revealAt: string | null
  revealed: boolean
  /** Only present once revealed. */
  answer: RevealAnswer | null
  title: string
  message: string
  /** The server's clock when this was read (to count down accurately). */
  serverNow: string | null
}

const answerOf = (v: unknown): RevealAnswer | null => (v === 'girl' || v === 'boy' || v === 'twin_girls' || v === 'twin_boys' || v === 'twins' ? v : null)

export const ANSWER_LABEL: Record<RevealAnswer, string> = {
  girl: 'It’s a Girl!',
  boy: 'It’s a Boy!',
  twin_girls: 'Twin Girls!',
  twin_boys: 'Twin Boys!',
  twins: 'Twins — a Boy & a Girl!',
}
/** Pink for girls, blue for boys, both for twins. */
export const ANSWER_COLOURS: Record<RevealAnswer, string[]> = {
  girl: ['#F4A7B9', '#F9C9D4', '#E98AA2'],
  boy: ['#8DB8E8', '#B9D5F2', '#6E9FD8'],
  twin_girls: ['#F4A7B9', '#F9C9D4', '#E98AA2'],
  twin_boys: ['#8DB8E8', '#B9D5F2', '#6E9FD8'],
  twins: ['#F4A7B9', '#8DB8E8', '#F9C9D4', '#B9D5F2'],
}

export async function getPublicReveal(): Promise<PublicReveal> {
  const { data, error } = await supabase.rpc('public_gender_reveal')
  if (error) {
    logError('getPublicReveal', error)
    return { enabled: false, revealAt: null, revealed: false, answer: null, title: '', message: '', serverNow: null }
  }
  const o = obj(data)
  return {
    enabled: o.enabled === true,
    revealAt: str(o.revealAt) || null,
    revealed: o.revealed === true,
    answer: answerOf(o.answer),
    title: str(o.title) || 'Boy or Girl?',
    message: str(o.message),
    serverNow: str(o.now) || null,
  }
}

/** Host (or admin): reveal it now, from the big screen. */
export async function revealNow(hostToken: string | null): Promise<PublicReveal | null> {
  const { data, error } = await supabase.rpc('gender_reveal_now', { p_token: hostToken ?? '' })
  if (error) fail('revealNow', error, 'The reveal couldn’t start. Please try again.')
  const o = obj(data)
  if (o.ok !== true) return null
  return getPublicReveal()
}

// admin

export interface RevealSettings {
  enabled: boolean
  answer: RevealAnswer | null
  revealAt: string | null
  title: string
  message: string
}

export async function getRevealSettings(): Promise<RevealSettings> {
  const { data, error } = await supabase.from('gender_reveal').select('*').eq('id', 1).maybeSingle()
  if (error) fail('getRevealSettings', error, 'The gender reveal couldn’t be loaded.')
  const r = obj(data)
  return { enabled: r.enabled === true, answer: answerOf(r.answer), revealAt: str(r.reveal_at) || null, title: str(r.title) || 'Boy or Girl?', message: str(r.message) }
}

export async function saveRevealSettings(s: RevealSettings): Promise<void> {
  const { error } = await supabase
    .from('gender_reveal')
    // One row per shower: the key is (space_id, id); space_id is filled in by the database.
    .upsert({ id: 1, enabled: s.enabled, answer: s.answer, reveal_at: s.revealAt, title: s.title.trim().slice(0, 80) || 'Boy or Girl?', message: s.message.trim().slice(0, 300) })
  if (error) fail('saveRevealSettings', error, 'The gender reveal couldn’t be saved.')
}

// ---------------------------------------------------------------- predictions

export interface Prediction {
  dueDate: string | null
  weightKg: number | null
  gender: 'girl' | 'boy' | null
}

export interface PredictionsInfo {
  visible: boolean
  open: boolean
  closeAt: string | null
  count: number
  me: string | null
  mine: Prediction | null
}

const toPrediction = (v: unknown): Prediction | null => {
  if (!v || typeof v !== 'object') return null
  const o = obj(v)
  return { dueDate: str(o.dueDate) || null, weightKg: num(o.weightKg), gender: o.gender === 'girl' || o.gender === 'boy' ? o.gender : null }
}

export async function getPredictionsInfo(token?: string | null): Promise<PredictionsInfo> {
  const { data, error } = await supabase.rpc('predictions_info', { p_token: token ?? null })
  if (error) fail('getPredictionsInfo', error, 'The predictions couldn’t be loaded. Please try again.')
  const o = obj(data)
  return { visible: o.visible === true, open: o.open === true, closeAt: str(o.closeAt) || null, count: num(o.count) ?? 0, me: str(o.me) || null, mine: toPrediction(o.mine) }
}

export type SaveResult = { ok: true } | { ok: false; reason: 'closed' | 'who' | 'invalid' | 'empty' }

export async function savePrediction(token: string, p: Prediction): Promise<SaveResult> {
  const { data, error } = await supabase.rpc('prediction_save', { p_token: token, p_due: p.dueDate, p_weight: p.weightKg, p_gender: p.gender })
  if (error) fail('savePrediction', error, 'Your guess didn’t save. Please try again.')
  const o = obj(data)
  if (o.ok === true) return { ok: true }
  return { ok: false, reason: o.reason === 'closed' || o.reason === 'who' || o.reason === 'empty' ? o.reason : 'invalid' }
}

export interface PredictionsBoard {
  visible: boolean
  open: boolean
  count: number
  girl: number
  boy: number
  avgWeightKg: number | null
  dueDates: { date: string; n: number }[]
  actual: { birthDate: string | null; weightKg: number | null; gender: 'girl' | 'boy' | null }
  closestDate: { name: string; guess: string; off: number }[]
  closestWeight: { name: string; guess: number; off: number }[]
  genderRight: string[]
}

export async function getPredictionsBoard(): Promise<PredictionsBoard> {
  const { data, error } = await supabase.rpc('predictions_board')
  if (error) fail('getPredictionsBoard', error, 'The results couldn’t be loaded.')
  const o = obj(data)
  const a = obj(o.actual)
  return {
    visible: o.visible === true,
    open: o.open === true,
    count: num(o.count) ?? 0,
    girl: num(o.girl) ?? 0,
    boy: num(o.boy) ?? 0,
    avgWeightKg: num(o.avgWeightKg),
    dueDates: arr(o.dueDates).map((x) => ({ date: str(obj(x).date), n: num(obj(x).n) ?? 0 })),
    actual: { birthDate: str(a.birthDate) || null, weightKg: num(a.weightKg), gender: a.gender === 'girl' || a.gender === 'boy' ? a.gender : null },
    closestDate: arr(o.closestDate).map((x) => ({ name: str(obj(x).name), guess: str(obj(x).guess), off: num(obj(x).off) ?? 0 })),
    closestWeight: arr(o.closestWeight).map((x) => ({ name: str(obj(x).name), guess: num(obj(x).guess) ?? 0, off: num(obj(x).off) ?? 0 })),
    genderRight: arr(o.genderRight).map(str),
  }
}

// admin

export interface PredictionsSettings {
  mode: Visibility
  from: string | null
  /** Guessing closes here (null = at the gender reveal, or never). */
  closeAt: string | null
  /** The real answers, typed in after the birth. */
  birthDate: string | null
  weightKg: number | null
}
export const DEFAULT_PREDICTIONS: PredictionsSettings = { mode: 'visible', from: null, closeAt: null, birthDate: null, weightKg: null }

export async function getPredictionsSettings(): Promise<PredictionsSettings> {
  const v = obj(await getAdminPreference('predictions'))
  return {
    mode: v.mode === undefined ? DEFAULT_PREDICTIONS.mode : visibility(v.mode),
    from: str(v.from) || null,
    closeAt: str(v.closeAt) || null,
    birthDate: str(v.birthDate) || null,
    weightKg: num(v.weightKg),
  }
}
export const savePredictionsSettings = (s: PredictionsSettings) => saveAdminPreference('predictions', s)

export interface AdminPrediction extends Prediction {
  id: string
  name: string
  at: string
}
export async function listPredictionsAdmin(): Promise<AdminPrediction[]> {
  const { data, error } = await supabase.from('baby_predictions').select('*').order('created_at')
  if (error) fail('listPredictionsAdmin', error, 'The guesses couldn’t be loaded.')
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: str(r.id),
    name: str(r.name),
    at: str(r.updated_at) || str(r.created_at),
    dueDate: str(r.due_date) || null,
    weightKg: num(r.weight_kg),
    gender: r.gender === 'girl' || r.gender === 'boy' ? r.gender : null,
  }))
}
export async function deletePrediction(id: string): Promise<void> {
  const { error } = await supabase.from('baby_predictions').delete().eq('id', id)
  if (error) fail('deletePrediction', error, 'The guess couldn’t be removed.')
}

// ---------------------------------------------------------------- name ideas

export type NameFor = 'girl' | 'boy' | 'any'

export interface NameIdea {
  name: string
  forGender: NameFor
  count: number
  by: string[]
  notes: string[]
}
export interface MyNameIdea {
  id: string
  suggestion: string
  forGender: NameFor
  note: string
  status: 'visible' | 'pending'
}
export interface NameIdeasInfo {
  visible: boolean
  approval: 'instant' | 'approve'
  perGuest: number
  me: string | null
  mine: MyNameIdea[]
}

const forOf = (v: unknown): NameFor => (v === 'girl' || v === 'boy' ? v : 'any')

export async function getNameIdeasInfo(token?: string | null): Promise<NameIdeasInfo> {
  const { data, error } = await supabase.rpc('name_ideas_info', { p_token: token ?? null })
  if (error) fail('getNameIdeasInfo', error, 'The name ideas couldn’t be loaded. Please try again.')
  const o = obj(data)
  return {
    visible: o.visible === true,
    approval: o.approval === 'approve' ? 'approve' : 'instant',
    perGuest: num(o.perGuest) ?? 3,
    me: str(o.me) || null,
    mine: arr(o.mine).map((x) => {
      const r = obj(x)
      return { id: str(r.id), suggestion: str(r.suggestion), forGender: forOf(r.forGender), note: str(r.note), status: r.status === 'pending' ? 'pending' : 'visible' }
    }),
  }
}

export async function listNameIdeas(): Promise<NameIdea[]> {
  const { data, error } = await supabase.rpc('name_ideas_list')
  if (error) fail('listNameIdeas', error, 'The name ideas couldn’t be loaded.')
  return arr(data).map((x) => {
    const r = obj(x)
    return { name: str(r.name), forGender: forOf(r.forGender), count: num(r.count) ?? 1, by: arr(r.by).map(str).filter(Boolean), notes: arr(r.notes).map(str).filter(Boolean) }
  })
}

export type AddIdeaResult = { ok: true; pending: boolean } | { ok: false; reason: 'closed' | 'who' | 'invalid' | 'limit' | 'duplicate'; limit?: number }

export async function addNameIdea(token: string, suggestion: string, forGender: NameFor, note: string): Promise<AddIdeaResult> {
  const { data, error } = await supabase.rpc('name_idea_add', { p_token: token, p_suggestion: suggestion, p_for: forGender, p_note: note })
  if (error) fail('addNameIdea', error, 'Your idea didn’t save. Please try again.')
  const o = obj(data)
  if (o.ok === true) return { ok: true, pending: o.pending === true }
  const reason = o.reason === 'closed' || o.reason === 'who' || o.reason === 'limit' || o.reason === 'duplicate' ? o.reason : 'invalid'
  return { ok: false, reason, limit: num(o.limit) ?? undefined }
}

export async function removeNameIdea(token: string, id: string): Promise<void> {
  const { error } = await supabase.rpc('name_idea_remove', { p_token: token, p_id: id })
  if (error) fail('removeNameIdea', error, 'That didn’t save. Please try again.')
}

// admin

export interface NamesSettings {
  mode: Visibility
  from: string | null
  approval: 'instant' | 'approve'
  perGuest: number
}
export const DEFAULT_NAMES: NamesSettings = { mode: 'visible', from: null, approval: 'instant', perGuest: 3 }

export async function getNamesSettings(): Promise<NamesSettings> {
  const v = obj(await getAdminPreference('names'))
  return {
    mode: v.mode === undefined ? DEFAULT_NAMES.mode : visibility(v.mode),
    from: str(v.from) || null,
    approval: v.approval === 'approve' ? 'approve' : 'instant',
    perGuest: Math.max(1, Math.min(10, num(v.perGuest) ?? 3)),
  }
}
export const saveNamesSettings = (s: NamesSettings) => saveAdminPreference('names', s)

export interface AdminNameIdea {
  id: string
  suggestion: string
  forGender: NameFor
  note: string
  byName: string
  status: 'visible' | 'pending' | 'hidden'
  at: string
}
export async function listNameIdeasAdmin(): Promise<AdminNameIdea[]> {
  const { data, error } = await supabase.from('name_suggestions').select('*').order('created_at', { ascending: false })
  if (error) fail('listNameIdeasAdmin', error, 'The name ideas couldn’t be loaded.')
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: str(r.id),
    suggestion: str(r.suggestion),
    forGender: forOf(r.for_gender),
    note: str(r.note),
    byName: str(r.by_name),
    status: r.status === 'pending' || r.status === 'hidden' ? r.status : 'visible',
    at: str(r.created_at),
  }))
}
export async function setNameIdeaStatus(id: string, status: AdminNameIdea['status']): Promise<void> {
  const { error } = await supabase.from('name_suggestions').update({ status }).eq('id', id)
  if (error) fail('setNameIdeaStatus', error, 'That didn’t save.')
}
export async function deleteNameIdea(id: string): Promise<void> {
  const { error } = await supabase.from('name_suggestions').delete().eq('id', id)
  if (error) fail('deleteNameIdea', error, 'The idea couldn’t be removed.')
}
