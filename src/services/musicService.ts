import { supabase } from '../lib/supabase'
import { FriendlyError, logError } from '../utils/errors'
import { getAdminPreference, saveAdminPreference } from './preferencesService'

/** Pages the song can play on. */
export const MUSIC_PAGES = [
  { id: 'home', label: 'Home page' },
  { id: 'invite', label: 'Virtual invitation' },
  { id: 'rsvp', label: 'RSVP' },
  { id: 'photos', label: 'Guest photos' },
] as const
export type MusicPage = (typeof MUSIC_PAGES)[number]['id']

export interface MusicSettings {
  enabled: boolean
  url: string
  path: string
  /** The file's name, for the admin. */
  title: string
  duration: number
  start: number
  end: number | null
  fadeIn: number
  fadeOut: number
  loop: boolean
  volume: number
  pages: MusicPage[]
  /** Try to start as soon as the page opens (browsers often block this until a tap). */
  autoplay: boolean
  /** Home page: a "Tap to enter" welcome screen — the tap starts the music for sure. */
  welcome: boolean
}

export const DEFAULT_MUSIC: MusicSettings = {
  enabled: false,
  url: '',
  path: '',
  title: '',
  duration: 0,
  start: 0,
  end: null,
  fadeIn: 2,
  fadeOut: 3,
  loop: true,
  volume: 0.4,
  pages: ['home', 'invite'],
  autoplay: false,
  welcome: false,
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const pagesOf = (v: unknown): MusicPage[] => (Array.isArray(v) ? v.filter((x): x is MusicPage => MUSIC_PAGES.some((p) => p.id === x)) : DEFAULT_MUSIC.pages)

export async function getMusicSettings(): Promise<MusicSettings> {
  const v = ((await getAdminPreference<Record<string, unknown>>('music')) ?? {}) as Record<string, unknown>
  return {
    enabled: v.enabled === true,
    url: typeof v.url === 'string' ? v.url : '',
    path: typeof v.path === 'string' ? v.path : '',
    title: typeof v.title === 'string' ? v.title : '',
    duration: num(v.duration, 0),
    start: num(v.start, 0),
    end: typeof v.end === 'number' ? v.end : null,
    fadeIn: num(v.fadeIn, 2),
    fadeOut: num(v.fadeOut, 3),
    loop: v.loop !== false,
    volume: num(v.volume, 0.4),
    pages: pagesOf(v.pages),
    autoplay: v.autoplay === true,
    welcome: v.welcome === true,
  }
}

export async function saveMusicSettings(s: MusicSettings): Promise<void> {
  await saveAdminPreference('music', s)
}

const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg']
export const MAX_SONG_MB = 15

/** Uploads a song to the website's storage. Returns its address and storage path. */
export async function uploadSong(file: File): Promise<{ url: string; path: string }> {
  const type = file.type || (/\.m4a$/i.test(file.name) ? 'audio/mp4' : /\.mp3$/i.test(file.name) ? 'audio/mpeg' : '')
  if (!AUDIO_TYPES.includes(type)) throw new FriendlyError('Please choose an MP3 or M4A song.')
  if (file.size > MAX_SONG_MB * 1048576) throw new FriendlyError(`That file is over ${MAX_SONG_MB} MB. Please choose a smaller one (most songs are 3–8 MB).`)
  const ext = type === 'audio/mpeg' ? 'mp3' : type === 'audio/ogg' ? 'ogg' : 'm4a'
  const path = `music/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('wedding-assets').upload(path, file, { contentType: type, cacheControl: '31536000', upsert: false })
  if (error) {
    logError('uploadSong', error)
    throw new FriendlyError('The song couldn’t be uploaded. Please try again.')
  }
  return { url: supabase.storage.from('wedding-assets').getPublicUrl(path).data.publicUrl, path }
}

/** Removes an old song file (best effort). */
export async function removeSongFile(path: string): Promise<void> {
  if (!path) return
  const { error } = await supabase.storage.from('wedding-assets').remove([path])
  if (error) logError('removeSongFile', error)
}

export interface PublicMusic {
  url: string
  start: number
  end: number | null
  fadeIn: number
  fadeOut: number
  loop: boolean
  volume: number
  pages: MusicPage[]
  autoplay: boolean
  welcome: boolean
}

/** What guests should hear (null = no music). */
export async function getPublicMusic(): Promise<PublicMusic | null> {
  const { data, error } = await supabase.rpc('public_music')
  if (error) {
    logError('getPublicMusic', error)
    return null
  }
  const o = (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as Record<string, unknown>
  if (typeof o.url !== 'string' || !o.url) return null
  return {
    url: o.url,
    start: Number(o.start ?? 0) || 0,
    end: o.end === null || o.end === undefined ? null : Number(o.end),
    fadeIn: Number(o.fadeIn ?? 2),
    fadeOut: Number(o.fadeOut ?? 3),
    loop: o.loop !== false,
    volume: Number(o.volume ?? 0.4) || 0.4,
    pages: pagesOf(o.pages),
    autoplay: o.autoplay === true,
    welcome: o.welcome === true,
  }
}
