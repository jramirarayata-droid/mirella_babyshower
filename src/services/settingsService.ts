import { supabase, WEDDING_ASSETS_BUCKET } from '../lib/supabase'
import type { Json, Tables } from '../types/database'
import type {
  EntourageGroup,
  EntourageSettings,
  GallerySettings,
  InfoSection,
  MotifColor,
  MotifSettings,
  OutfitSectionSettings,
  ProgramSettings,
  RsvpSettings,
  SectionIconName,
  VerseSettings,
  VideoSettings,
  WeddingSettings,
  WeddingSettingsInput,
} from '../types/wedding'
import { GALLERY_LAYOUTS } from '../types/wedding'
import { FriendlyError, logError } from '../utils/errors'
import { parseThemeSettings, type ThemeSettings } from '../theme/themes'
import type { BuiltinKey, RsvpConfig, RsvpTeaser } from '../types/questions'
import { parseSeatingConfig } from './seatingService'
import type { SeatingConfig } from '../types/seating'

/** Is the guest seat finder switched on right now? */
export function isFinderOpen(c: SeatingConfig, revealAt?: string | null): boolean {
  if (c.finder.mode === 'visible') return true
  if (c.finder.mode === 'reveal') return Boolean(revealAt) && Date.now() >= new Date(revealAt!).getTime()
  return c.finder.mode === 'scheduled' && Boolean(c.finder.from) && Date.now() >= new Date(c.finder.from!).getTime()
}

export const SECTION_ICONS: { value: SectionIconName; label: string }[] = [
  { value: 'shirt', label: 'Attire' },
  { value: 'church', label: 'Church' },
  { value: 'wine', label: 'Toast' },
  { value: 'camera-off', label: 'No cameras' },
  { value: 'gift', label: 'Gift' },
  { value: 'car', label: 'Car' },
  { value: 'parking', label: 'Parking' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'clock', label: 'Clock' },
  { value: 'music', label: 'Music' },
  { value: 'utensils', label: 'Dining' },
  { value: 'map-pin', label: 'Location' },
  { value: 'heart', label: 'Heart' },
  { value: 'info', label: 'Info' },
]

const ICON_VALUES = new Set<string>(SECTION_ICONS.map((i) => i.value))

export function newSectionId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parseSections(value: Json): InfoSection[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const o = item as Record<string, Json | undefined>
    const title = typeof o.title === 'string' ? o.title : ''
    const body = typeof o.body === 'string' ? o.body : ''
    if (!title && !body) return []
    const icon = typeof o.icon === 'string' && ICON_VALUES.has(o.icon) ? (o.icon as SectionIconName) : 'info'
    return [
      {
        id: typeof o.id === 'string' && o.id ? o.id : `section-${index}`,
        title,
        body,
        icon,
        visible: o.visible !== false,
      },
    ]
  })
}

const str = (v: Json | undefined): string => (typeof v === 'string' ? v : '')
const obj = (v: Json): Record<string, Json | undefined> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, Json | undefined>) : null)

function parseEntourage(value: Json): EntourageGroup[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((g, gi) => {
    const o = obj(g)
    if (!o) return []
    const members = Array.isArray(o.members)
      ? o.members.flatMap((m, mi) => {
          const mo = obj(m as Json)
          if (!mo) return []
          return [{ id: str(mo.id) || `m-${gi}-${mi}`, name: str(mo.name), role: str(mo.role) }]
        })
      : []
    return [{ id: str(o.id) || `g-${gi}`, title: str(o.title), layout: o.layout === 'list' ? ('list' as const) : ('pairs' as const), members }]
  })
}

function parseMotif(value: Json): MotifColor[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((c, i) => {
    const o = obj(c)
    if (!o) return []
    const hex = str(o.hex)
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return []
    return [{ id: str(o.id) || `c-${i}`, name: str(o.name), hex }]
  })
}

const BUILTIN_KEYS: BuiltinKey[] = ['transportation', 'comingFrom', 'food', 'dietary', 'accessibility', 'additionalGuest', 'message']

function parseRsvpConfig(value: Json): RsvpConfig {
  const o = obj(value)
  const b = o ? obj((o.builtins ?? null) as Json) : null
  const builtins: RsvpConfig['builtins'] = {}
  for (const k of BUILTIN_KEYS) {
    const c = b ? obj((b[k] ?? null) as Json) : null
    if (!c) continue
    builtins[k] = {
      enabled: c.enabled !== false,
      label: typeof c.label === 'string' ? c.label : undefined,
      required: typeof c.required === 'boolean' ? c.required : undefined,
      price: typeof c.price === 'number' && c.price >= 0 ? c.price : undefined,
    }
  }
  const t = o ? obj((o.teaser ?? null) as Json) : null
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
  const teaser: RsvpTeaser | undefined = t
    ? { enabled: t.enabled === true, title: text(t.title, 120), highlight: text(t.highlight, 40), note: text(t.note, 160) }
    : undefined
  return teaser ? { builtins, teaser } : { builtins }
}

/** True while guests may still RSVP (switch on and deadline not passed). */
export function isRsvpOpen(s: Pick<WeddingSettings, 'rsvpOpen' | 'rsvpDeadline'>, now = Date.now()): boolean {
  if (!s.rsvpOpen) return false
  if (!s.rsvpDeadline) return true
  return now < new Date(s.rsvpDeadline).getTime()
}

function fromRow(row: Tables<'wedding_settings'>): WeddingSettings {
  return {
    id: row.id,
    coupleNames: row.couple_names ?? '',
    babyName: row.baby_name?.trim() || 'Baby',
    weddingDate: row.wedding_date ?? '',
    dueDate: row.due_date ?? null,
    dueText: row.due_text ?? '',
    dueVisible: row.due_visible !== false,
    heroTitle: row.hero_title ?? row.baby_name ?? '',
    heroSubtitle: row.hero_subtitle ?? '',
    heroImageUrl: row.hero_image_url ?? '',
    churchName: row.church_name ?? '',
    ceremonyTime: row.ceremony_time ?? '',
    receptionTime: row.reception_time ?? '',
    churchMapUrl: row.church_map_url ?? '',
    receptionName: row.reception_name ?? '',
    receptionMapUrl: row.reception_map_url ?? '',
    storyText: row.story_text ?? '',
    closingMessage: row.closing_message ?? '',
    sections: parseSections(row.additional_info),
    outfitTitle: row.outfit_title ?? 'What to Wear',
    outfitSubtitle: row.outfit_subtitle ?? '',
    outfitSectionVisible: row.outfit_section_visible !== false,
    outfitLayout: (row as { outfit_layout?: string | null }).outfit_layout === 'pairs' ? 'pairs' : 'tabs',
    rsvpDeadline: row.rsvp_deadline ?? null,
    rsvpOpen: row.rsvp_open !== false,
    rsvpClosedMessage: row.rsvp_closed_message ?? '',
    rsvpShowDeadline: row.rsvp_show_deadline ?? true,
    rsvpButtonLabel: row.rsvp_button_label?.trim() || 'RSVP',
    entourage: parseEntourage(row.entourage),
    entourageVisible: false,
    entourageTitle: row.entourage_title ?? 'The Entourage',
    entourageSubtitle: row.entourage_subtitle ?? '',
    motifTitle: row.motif_title ?? 'Our Motif',
    motifColors: parseMotif(row.motif_colors),
    galleryVisible: row.gallery_visible !== false,
    mediaOrder: Array.isArray((row as { media_order?: unknown }).media_order) ? ((row as { media_order: unknown[] }).media_order.filter((x) => typeof x === 'string') as string[]) : [],
    galleryTitle: row.gallery_title ?? 'Waiting for You, Little One',
    gallerySubtitle: row.gallery_subtitle ?? '',
    galleryLayout: GALLERY_LAYOUTS.find((g) => g.id === row.gallery_layout)?.id ?? 'grid',
    videoVisible: row.video_visible !== false,
    videoTitle: row.video_title ?? 'Our Baby Journey',
    videoCaption: row.video_caption ?? '',
    videoUrl: row.video_url ?? '',
    videoPosterUrl: row.video_poster_url ?? '',
    theme: parseThemeSettings(row.theme),
    rsvpConfig: parseRsvpConfig(row.rsvp_config),
    seatingConfig: parseSeatingConfig(row.seating_config),
    // Program & verse (migration 040): missing columns read as "hidden".
    programVisible: row.program_visible === true,
    programTitle: row.program_title ?? '',
    programSubtitle: row.program_subtitle ?? '',
    verseVisible: row.verse_visible === true,
    verseText: row.verse_text ?? '',
    verseReference: row.verse_reference ?? '',
    updatedAt: row.updated_at,
  }
}

const emptyToNull = (v: string) => (v.trim() ? v.trim() : null)

/** Public: loads the single settings row (wedding_settings) that drives the website. */
export async function getWeddingSettings(): Promise<WeddingSettings> {
  const { data, error } = await supabase.from('wedding_settings').select('*').limit(1).maybeSingle()
  if (error || !data) {
    logError('getWeddingSettings', error ?? 'No settings row found. Did you run supabase/schema.sql?')
    throw new FriendlyError()
  }
  return fromRow(data as Tables<'wedding_settings'>)
}

/** Admin: saves all website settings. */
export async function updateWeddingSettings(id: string, input: WeddingSettingsInput): Promise<WeddingSettings> {
  const sections = input.sections.map((s) => ({
    id: s.id,
    title: s.title.trim(),
    body: s.body.trim(),
    icon: s.icon,
    visible: s.visible,
  }))
  const { data, error } = await supabase
    .from('wedding_settings')
    .update({
      couple_names: input.coupleNames.trim(),
      baby_name: input.babyName.trim().slice(0, 60) || 'Baby',
      wedding_date: input.weddingDate,
      due_date: input.dueDate || null,
      due_text: emptyToNull(input.dueText.slice(0, 80)),
      due_visible: input.dueVisible,
      hero_title: emptyToNull(input.heroTitle),
      hero_subtitle: emptyToNull(input.heroSubtitle),
      hero_image_url: emptyToNull(input.heroImageUrl),
      church_name: emptyToNull(input.churchName),
      ceremony_time: emptyToNull(input.ceremonyTime),
      reception_time: emptyToNull(input.receptionTime),
      church_map_url: emptyToNull(input.churchMapUrl),
      reception_name: emptyToNull(input.receptionName),
      reception_map_url: emptyToNull(input.receptionMapUrl),
      story_text: emptyToNull(input.storyText),
      closing_message: emptyToNull(input.closingMessage),
      additional_info: sections as unknown as Json,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) {
    logError('updateWeddingSettings', error)
    throw new FriendlyError('We couldn’t save the website settings. Please try again.')
  }
  return fromRow(data as Tables<'wedding_settings'>)
}

async function updatePartial(id: string, patch: Record<string, unknown>, context: string, message: string): Promise<WeddingSettings> {
  const { data, error } = await supabase.from('wedding_settings').update(patch).eq('id', id).select('*').single()
  if (error || !data) {
    logError(context, error)
    throw new FriendlyError(message)
  }
  return fromRow(data as Tables<'wedding_settings'>)
}

/** Admin: RSVP deadline / open switch / closed message. */
export function updateRsvpSettings(id: string, input: RsvpSettings): Promise<WeddingSettings> {
  return updatePartial(
    id,
    {
      rsvp_deadline: input.rsvpDeadline,
      rsvp_open: input.rsvpOpen,
      rsvp_closed_message: emptyToNull(input.rsvpClosedMessage),
      rsvp_show_deadline: input.rsvpShowDeadline,
      rsvp_button_label: input.rsvpButtonLabel.trim().replace(/\s+/g, ' ').slice(0, 30) || 'RSVP',
    },
    'updateRsvpSettings',
    'We couldn’t save the RSVP settings. Please try again.',
  )
}

/** Admin: the entourage / processional list. */
export function updateEntourage(id: string, input: EntourageSettings): Promise<WeddingSettings> {
  const entourage = input.entourage.map((g) => ({
    id: g.id,
    title: g.title.trim(),
    layout: g.layout,
    members: g.members.filter((m) => m.name.trim()).map((m) => ({ id: m.id, name: m.name.trim(), role: m.role.trim() })),
  }))
  return updatePartial(
    id,
    {
      entourage,
      entourage_visible: input.entourageVisible,
      entourage_title: emptyToNull(input.entourageTitle),
      entourage_subtitle: emptyToNull(input.entourageSubtitle),
    },
    'updateEntourage',
    'We couldn’t save the entourage. Please try again.',
  )
}

const NEEDS_040 = 'This needs the new database update (migration 040) first.'
const missing040 = (e: { message?: string } | null) => /program_|verse_/.test(e?.message ?? '')

/** Admin: show/hide and titles of the program flow section. */
export async function updateProgramSettings(id: string, input: ProgramSettings): Promise<WeddingSettings> {
  const { data, error } = await supabase
    .from('wedding_settings')
    .update({
      program_visible: input.programVisible,
      program_title: emptyToNull(input.programTitle.slice(0, 80)),
      program_subtitle: emptyToNull(input.programSubtitle.slice(0, 300)),
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) {
    logError('updateProgramSettings', error)
    throw new FriendlyError(missing040(error) ? NEEDS_040 : 'We couldn’t save the program. Please try again.')
  }
  return fromRow(data as Tables<'wedding_settings'>)
}

/** Admin: the highlighted Bible verse. */
export async function updateVerse(id: string, input: VerseSettings): Promise<WeddingSettings> {
  const { data, error } = await supabase
    .from('wedding_settings')
    .update({
      verse_visible: input.verseVisible,
      verse_text: emptyToNull(input.verseText.slice(0, 1200)),
      verse_reference: emptyToNull(input.verseReference.slice(0, 120)),
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) {
    logError('updateVerse', error)
    throw new FriendlyError(missing040(error) ? NEEDS_040 : 'We couldn’t save the Bible verse. Please try again.')
  }
  return fromRow(data as Tables<'wedding_settings'>)
}

/** Admin: the order of the photo & video sections on the home page. */
export async function updateMediaOrder(id: string, order: string[]): Promise<void> {
  const { error } = await supabase.from('wedding_settings').update({ media_order: order }).eq('id', id)
  if (error) {
    logError('updateMediaOrder', error)
    throw new FriendlyError(
      /media_order/.test(error.message ?? '') ? 'The order can’t be saved yet — run migration 038 in Supabase first.' : 'The new order could not be saved. Please try again.',
    )
  }
}

/**
 * The extra sections were reordered elsewhere (their own up/down buttons): keep
 * the saved home-page order in step — the sections take the new order within
 * the places they had; the main gallery and video stay where they were.
 */
export async function syncSectionsInMediaOrder(sectionIds: string[]): Promise<void> {
  const s = await getWeddingSettings()
  const saved = s.mediaOrder ?? []
  if (!saved.length) return
  const queue = [...sectionIds]
  const next = saved.filter((k) => k === 'gallery' || k === 'video' || sectionIds.includes(k)).map((k) => (k === 'gallery' || k === 'video' ? k : queue.shift() ?? k))
  for (const id of queue) if (!next.includes(id)) next.push(id)
  await updateMediaOrder(s.id, next)
}

/** The home page's photo & video sections in the saved order (anything new goes after, in its usual place). */
export function orderMedia<T extends { key: string }>(items: T[], order: string[]): T[] {
  const rank = new Map(order.map((k, i) => [k, i]))
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (rank.get(a.it.key) ?? 1000 + a.i) - (rank.get(b.it.key) ?? 1000 + b.i))
    .map((x) => x.it)
}

/** Admin: bump photo gallery section. */
export function updateGallerySettings(id: string, input: GallerySettings): Promise<WeddingSettings> {
  return updatePartial(
    id,
    {
      gallery_visible: input.galleryVisible,
      gallery_title: emptyToNull(input.galleryTitle),
      gallery_subtitle: emptyToNull(input.gallerySubtitle),
      gallery_layout: input.galleryLayout,
    },
    'updateGallerySettings',
    'We couldn’t save the gallery settings. Please try again.',
  )
}

/** Admin: the main video section. */
export function updateVideoSettings(id: string, input: VideoSettings): Promise<WeddingSettings> {
  return updatePartial(
    id,
    {
      video_visible: input.videoVisible,
      video_title: emptyToNull(input.videoTitle),
      video_caption: emptyToNull(input.videoCaption),
      video_url: emptyToNull(input.videoUrl),
      video_poster_url: emptyToNull(input.videoPosterUrl),
    },
    'updateVideoSettings',
    'We couldn’t save the video settings. Please check the link and try again.',
  )
}

/** Admin: Look & Feel (template, fonts, colours, hero layout). */
export function updateTheme(id: string, theme: ThemeSettings): Promise<WeddingSettings> {
  const clean: Record<string, string> = { template: theme.template }
  for (const k of ['headingFont', 'bodyFont', 'background', 'text', 'accent', 'heroLayout'] as const) {
    const v = theme[k]
    if (v) clean[k] = v
  }
  return updatePartial(id, { theme: clean }, 'updateTheme', 'We couldn’t save the new look. Please try again.')
}

/** Admin: built-in RSVP questions (on/off, labels, required). */
export async function updateRsvpConfig(id: string, config: RsvpConfig): Promise<WeddingSettings> {
  // The raffle note lives alongside the questions: keep it when only the questions change.
  const teaser = config.teaser ?? (await getWeddingSettings()).rsvpConfig.teaser
  const next: RsvpConfig = teaser ? { ...config, teaser } : config
  return updatePartial(id, { rsvp_config: next }, 'updateRsvpConfig', 'We couldn’t save the question settings. Please try again.')
}

/** Admin: the highlighted raffle note on the RSVP search page (kept alongside the question settings). */
export async function updateRsvpTeaser(id: string, teaser: RsvpTeaser): Promise<WeddingSettings> {
  // Start from the saved question settings so nothing else is overwritten.
  const current = await getWeddingSettings()
  const config: RsvpConfig = { ...current.rsvpConfig, teaser }
  return updatePartial(id, { rsvp_config: config }, 'updateRsvpTeaser', 'We couldn’t save the raffle note. Please try again.')
}

/** Admin: dress-code motif colours. */
export function updateMotif(id: string, input: MotifSettings): Promise<WeddingSettings> {
  return updatePartial(
    id,
    {
      motif_title: emptyToNull(input.motifTitle),
      motif_colors: input.motifColors.map((c) => ({ id: c.id, name: c.name.trim(), hex: c.hex.toUpperCase() })),
    },
    'updateMotif',
    'We couldn’t save the motif colours. Please try again.',
  )
}

/** Admin: saves the title/subtitle/visibility of the outfit inspiration section. */
export async function updateOutfitSectionSettings(id: string, input: OutfitSectionSettings): Promise<WeddingSettings> {
  const { data, error } = await supabase
    .from('wedding_settings')
    .update({
      outfit_title: emptyToNull(input.outfitTitle),
      outfit_subtitle: emptyToNull(input.outfitSubtitle),
      outfit_section_visible: input.outfitSectionVisible,
      outfit_layout: input.outfitLayout,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) {
    logError('updateOutfitSectionSettings', error)
    throw new FriendlyError('We couldn’t save the section settings. Please try again.')
  }
  return fromRow(data as Tables<'wedding_settings'>)
}

/**
 * Admin: uploads an image to the public `wedding-assets` bucket and returns its
 * public URL. `name` is the logical file name, e.g. "hero".
 */
export async function uploadWeddingAsset(file: File, name: 'hero' | 'logo' | 'background' | 'outfits/male' | 'outfits/female' = 'hero'): Promise<string> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  if (!allowed.includes(file.type)) throw new FriendlyError('Please choose a JPG, PNG, WebP or AVIF image.')
  if (file.size > 10 * 1024 * 1024) throw new FriendlyError('Please choose an image smaller than 10 MB.')

  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
  // A timestamped path avoids stale CDN caches when the image is replaced.
  const path = `${name}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(WEDDING_ASSETS_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type,
  })
  if (error) {
    logError('uploadWeddingAsset', error)
    throw new FriendlyError('The image could not be uploaded. Please check the storage setup and try again.')
  }
  const { data } = supabase.storage.from(WEDDING_ASSETS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
