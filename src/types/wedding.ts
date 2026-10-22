import type { ThemeSettings } from '../theme/themes'
import type { RsvpConfig } from './questions'
import type { SeatingConfig } from './seating'

export type SectionIconName =
  | 'shirt'
  | 'church'
  | 'wine'
  | 'camera-off'
  | 'gift'
  | 'car'
  | 'hotel'
  | 'clock'
  | 'parking'
  | 'info'
  | 'heart'
  | 'music'
  | 'utensils'
  | 'map-pin'

export interface InfoSection {
  /** Stable id used as React key; generated client-side for new sections. */
  id: string
  title: string
  body: string
  icon: SectionIconName
  visible: boolean
}

/**
 * The site settings (internal name kept from the framework). For the baby
 * shower: coupleNames = the parents' names, weddingDate = the shower date,
 * churchName / churchMapUrl / ceremonyTime = the one venue.
 */
export interface WeddingSettings {
  id: string
  /** The parents' names, e.g. "Juan & Maria Santos". */
  coupleNames: string
  /** The baby's name or nickname, e.g. "Baby Santos". */
  babyName: string
  /** The shower date (ISO, YYYY-MM-DD). */
  weddingDate: string
  /** Optional due date (ISO); shown as the month unless dueText is set. */
  dueDate: string | null
  /** Own wording for the due date, e.g. "Arriving: February 2027" ('' = from dueDate). */
  dueText: string
  dueVisible: boolean
  heroTitle: string
  heroSubtitle: string
  heroImageUrl: string
  /** The venue. */
  churchName: string
  /** Optional start time, e.g. "2:00 PM". */
  ceremonyTime: string
  /** Not used by the baby shower (one venue). */
  receptionTime: string
  churchMapUrl: string
  /** Not used by the baby shower (one venue). */
  receptionName: string
  /** Not used by the baby shower (one venue). */
  receptionMapUrl: string
  storyText: string
  closingMessage: string
  sections: InfoSection[]
  outfitTitle: string
  outfitSubtitle: string
  outfitSectionVisible: boolean
  /** Attire inspiration on the website: For Him / For Her tabs, or his & hers side by side under one label. */
  outfitLayout: OutfitLayout
  rsvpDeadline: string | null
  rsvpOpen: boolean
  rsvpClosedMessage: string
  rsvpShowDeadline: boolean
  rsvpButtonLabel: string
  /** How guests RSVP: the customer's guest list, or one open link for everyone. */
  rsvpMode: RsvpMode
  /** Open link: how many companions each guest may add (names required; they wait for approval). */
  openRsvpCompanions: number
  entourage: EntourageGroup[]
  entourageVisible: boolean
  entourageTitle: string
  entourageSubtitle: string
  motifTitle: string
  motifColors: MotifColor[]
  galleryVisible: boolean
  /** Order of the photo & video sections on the home page: 'gallery', 'video' and extra section ids ([] = default). */
  mediaOrder?: string[]
  galleryTitle: string
  gallerySubtitle: string
  galleryLayout: GalleryLayout
  videoVisible: boolean
  videoTitle: string
  videoCaption: string
  videoUrl: string
  videoPosterUrl: string
  theme: ThemeSettings
  rsvpConfig: RsvpConfig
  seatingConfig: SeatingConfig
  /** Program flow section (the moments themselves are in their own table, see ProgramItem). */
  programVisible: boolean
  programTitle: string
  programSubtitle: string
  /** Highlighted Bible verse. */
  verseVisible: boolean
  verseText: string
  verseReference: string
  updatedAt: string
}

/** One moment of the program flow, e.g. "2:00 PM — Wedding Ceremony". */
export interface ProgramItem {
  id: string
  /** Free text, e.g. "2:00 PM" ('' = no time). */
  time: string
  title: string
  description: string
}

export interface ProgramSettings {
  programVisible: boolean
  programTitle: string
  programSubtitle: string
}

export interface VerseSettings {
  verseVisible: boolean
  verseText: string
  verseReference: string
}

export interface GalleryImage {
  id: string
  imageUrl: string
  /** Small copy (~800 px) for grids; null = none yet (the full photo is used). */
  thumbUrl?: string | null
  caption: string
  sortOrder: number
  isVisible: boolean
}

export interface GallerySettings {
  galleryVisible: boolean
  galleryTitle: string
  gallerySubtitle: string
  galleryLayout: GalleryLayout
}

export interface VideoSettings {
  videoVisible: boolean
  videoTitle: string
  videoCaption: string
  videoUrl: string
  videoPosterUrl: string
}

export interface EntourageMember {
  id: string
  name: string
  /** Optional sub-role, e.g. "Candle", "Ring", "Ninong". */
  role: string
}

export interface EntourageGroup {
  id: string
  title: string
  /** pairs = two columns (sponsors, couples); list = single column. */
  layout: 'pairs' | 'list'
  members: EntourageMember[]
}

export interface MotifColor {
  id: string
  name: string
  hex: string
}

export interface RsvpSettings {
  rsvpDeadline: string | null
  rsvpOpen: boolean
  rsvpClosedMessage: string
  /** Show the "respond by <date, time>" line to guests. */
  rsvpShowDeadline: boolean
  /** Text on the RSVP buttons, e.g. "Confirm Attendance". */
  rsvpButtonLabel: string
}

/** list = only the names the customer added; open = anyone with the link signs up. */
export type RsvpMode = 'list' | 'open'

export interface EntourageSettings {
  entourage: EntourageGroup[]
  entourageVisible: boolean
  entourageTitle: string
  entourageSubtitle: string
}

export interface MotifSettings {
  motifTitle: string
  motifColors: MotifColor[]
}

export interface GiftSettings {
  isVisible: boolean
  placement: 'private' | 'public'
  title: string
  message: string
  qrImageUrl: string
}

export interface PublicGift {
  title: string
  message: string
  qrImageUrl: string
}

export type OutfitGender = 'male' | 'female'

export interface OutfitImage {
  id: string
  gender: OutfitGender
  imageUrl: string
  caption: string
  /** Short tag above the caption, e.g. "Principal Sponsors" ('' = none). */
  label: string
  sortOrder: number
  isVisible: boolean
}

export type WeddingSettingsInput = Omit<
  WeddingSettings,
  | 'id'
  | 'updatedAt'
  | 'outfitTitle'
  | 'outfitSubtitle'
  | 'outfitSectionVisible'
  | 'outfitLayout'
  | keyof RsvpSettings
  | 'rsvpMode'
  | 'openRsvpCompanions'
  | keyof EntourageSettings
  | keyof MotifSettings
  | keyof GallerySettings
  | keyof VideoSettings
  | 'theme'
  | 'rsvpConfig'
  | 'seatingConfig'
  | keyof ProgramSettings
  | keyof VerseSettings
>

export type OutfitLayout = 'tabs' | 'pairs'

export interface OutfitSectionSettings {
  outfitTitle: string
  outfitSubtitle: string
  outfitSectionVisible: boolean
  /** Attire inspiration on the website: For Him / For Her tabs, or his & hers side by side under one label. */
  outfitLayout: OutfitLayout
}

/** How the couple's photos are shown on the home page (Admin → Photos & Video). */
export type GalleryLayout = 'grid' | 'carousel' | 'polaroid' | 'filmstrip' | 'mosaic' | 'story' | 'deck' | 'coverflow' | 'arches' | 'timeline'

export const GALLERY_LAYOUTS: { id: GalleryLayout; name: string; description: string }[] = [
  { id: 'grid', name: 'Magazine grid', description: 'Mixed-size photo grid' },
  { id: 'carousel', name: 'Swipe carousel', description: 'One row with arrows' },
  { id: 'polaroid', name: 'Polaroid wall', description: 'Tilted instant photos with captions' },
  { id: 'filmstrip', name: 'Film strip', description: 'Two rows drifting like a reel' },
  { id: 'mosaic', name: 'Featured mosaic', description: 'One big photo that changes, with tiles' },
  { id: 'story', name: 'Story', description: 'One photo at a time, like Instagram stories' },
  { id: 'deck', name: 'Card deck', description: 'Swipe photos away like cards' },
  { id: 'coverflow', name: 'Coverflow', description: '3D photos sliding past the centre' },
  { id: 'arches', name: 'Arched frames', description: 'Gallery wall of arches and ovals' },
  { id: 'timeline', name: 'Our timeline', description: 'Photos along a line, chapter by chapter' },
]
