/**
 * "Save to Google Drive" — everything happens in the admin's browser:
 * photos are downloaded from Supabase storage and uploaded with the Drive API.
 * Sign-in uses Google Identity Services (token client) with the narrow
 * `drive.file` scope: the site can only see the files and folders it created
 * itself — never the rest of the admin's Drive. No token is ever stored on a
 * server (it lives in this page's memory for up to an hour).
 */
import { getAdminPreference, saveAdminPreference } from './preferencesService'

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const DRIVE = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const PREF_KEY = 'google_drive'

export type DriveTarget = 'guest' | 'ours'

export interface DrivePrefs {
  clientId?: string
  /** Folder ids we created, so a re-run reuses them. */
  folders?: Partial<Record<DriveTarget, string>>
}

/** One photo to save. `sourceId` never changes, so a re-run can tell what's already in Drive. */
export interface DriveItem {
  sourceId: string
  url: string
  fileName: string
}

export interface DriveProgress {
  total: number
  done: number
  uploaded: number
  skipped: number
  failed: number
}

export class DriveError extends Error {
  constructor(
    message: string,
    readonly kind: 'signin' | 'expired' | 'cancelled' | 'setup' | 'other' = 'other',
  ) {
    super(message)
  }
}

// ---------------------------------------------------------------- settings

export async function getDrivePrefs(): Promise<DrivePrefs> {
  return (await getAdminPreference<DrivePrefs>(PREF_KEY)) ?? {}
}
async function saveDrivePrefs(p: DrivePrefs) {
  await saveAdminPreference(PREF_KEY, p)
}
/** The Client ID set in the admin, else the build's VITE_GOOGLE_CLIENT_ID. */
export async function driveClientId(): Promise<string> {
  const p = await getDrivePrefs()
  return (p.clientId ?? '').trim() || String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()
}
export async function setDriveClientId(clientId: string): Promise<void> {
  const p = await getDrivePrefs()
  await saveDrivePrefs({ ...p, clientId: clientId.trim() })
}
export const looksLikeClientId = (v: string) => /^[\w-]+\.apps\.googleusercontent\.com$/.test(v.trim())

// ---------------------------------------------------------------- sign-in (Google Identity Services)

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}
interface TokenClient {
  requestAccessToken: (o?: { prompt?: string }) => void
}
interface GoogleOauth2 {
  initTokenClient: (cfg: {
    client_id: string
    scope: string
    callback: (r: TokenResponse) => void
    error_callback?: (e: { type?: string; message?: string }) => void
  }) => TokenClient
}
type GoogleGlobal = { accounts?: { oauth2?: GoogleOauth2 } }

let gisLoading: Promise<void> | null = null
/** Loads Google's sign-in script ahead of the click, so the sign-in window isn't blocked as a pop-up. */
export function loadGis(): Promise<void> {
  const g = (window as { google?: GoogleGlobal }).google
  if (g?.accounts?.oauth2) return Promise.resolve()
  gisLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      gisLoading = null
      reject(new DriveError('Google sign-in couldn’t load. Check your connection and try again.', 'signin'))
    }
    document.head.appendChild(s)
  })
  return gisLoading
}

let token: { value: string; until: number } | null = null

/** Asks Google for a Drive token (a Google pop-up the first time). Call from a button click. */
export async function signInToDrive(clientId: string): Promise<string> {
  if (token && token.until > Date.now() + 60_000) return token.value
  if (!clientId) throw new DriveError('Add your Google Client ID first.', 'setup')
  await loadGis()
  const oauth2 = (window as { google?: GoogleGlobal }).google?.accounts?.oauth2
  if (!oauth2) throw new DriveError('Google sign-in couldn’t load. Please try again.', 'signin')
  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (r) => {
        if (r.error || !r.access_token) {
          reject(new DriveError(r.error === 'access_denied' ? 'Google sign-in was cancelled.' : `Google sign-in failed (${r.error_description || r.error || 'no token'}).`, 'signin'))
          return
        }
        token = { value: r.access_token, until: Date.now() + (r.expires_in ?? 3600) * 1000 }
        resolve(r.access_token)
      },
      error_callback: (e) =>
        reject(new DriveError(e.type === 'popup_closed' ? 'The Google window was closed before signing in.' : e.type === 'popup_failed_to_open' ? 'The Google window was blocked. Allow pop-ups for this site and try again.' : 'Google sign-in failed.', 'signin')),
    })
    client.requestAccessToken({ prompt: '' })
  })
}
export const forgetDriveToken = () => {
  token = null
}

// ---------------------------------------------------------------- Drive API

async function api(path: string, init: RequestInit & { token: string; signal?: AbortSignal }, base = DRIVE): Promise<Response> {
  const { token: t, ...rest } = init
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${base}${path}`, { ...rest, headers: { ...(rest.headers ?? {}), Authorization: `Bearer ${t}` } })
    if (res.status === 401) {
      forgetDriveToken()
      throw new DriveError('Your Google sign-in expired. Click “Save to Google Drive” again — photos already saved will be skipped.', 'expired')
    }
    // Busy or a hiccup at Google: wait and try again a couple of times.
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 800 * 2 ** attempt))
      continue
    }
    return res
  }
}

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

/** The folder for this target: the one we made before if it still exists, else one with that name, else a new one. */
export async function ensureFolder(t: string, target: DriveTarget, name: string, signal?: AbortSignal): Promise<string> {
  const prefs = await getDrivePrefs()
  const known = prefs.folders?.[target]
  if (known) {
    const r = await api(`/files/${encodeURIComponent(known)}?fields=id,trashed`, { token: t, signal })
    if (r.ok) {
      const f = (await r.json()) as { id: string; trashed?: boolean }
      if (!f.trashed) return f.id
    }
  }
  const query = `mimeType='application/vnd.google-apps.folder' and name='${q(name)}' and trashed=false`
  const found = await api(`/files?q=${encodeURIComponent(query)}&fields=files(id)&spaces=drive`, { token: t, signal })
  if (!found.ok) throw new DriveError(`Google Drive refused the request (${found.status}).`)
  let id = ((await found.json()) as { files?: { id: string }[] }).files?.[0]?.id
  if (!id) {
    const made = await api('/files?fields=id', {
      token: t,
      signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
    })
    if (!made.ok) throw new DriveError(`The Google Drive folder couldn’t be created (${made.status}).`)
    id = ((await made.json()) as { id: string }).id
  }
  await saveDrivePrefs({ ...(await getDrivePrefs()), folders: { ...(prefs.folders ?? {}), [target]: id } })
  return id
}

/** Which photos are already in the folder (by the sourceId we stamp on each file). */
export async function savedSourceIds(t: string, folderId: string, signal?: AbortSignal): Promise<Set<string>> {
  const ids = new Set<string>()
  let page: string | undefined
  do {
    const query = `'${q(folderId)}' in parents and trashed=false`
    const r = await api(`/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,appProperties)&pageSize=1000${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`, { token: t, signal })
    if (!r.ok) throw new DriveError(`Google Drive refused the request (${r.status}).`)
    const j = (await r.json()) as { nextPageToken?: string; files?: { appProperties?: Record<string, string> }[] }
    for (const f of j.files ?? []) if (f.appProperties?.weddingSource) ids.add(f.appProperties.weddingSource)
    page = j.nextPageToken
  } while (page)
  return ids
}

const MULTIPART_MAX = 4 * 1024 * 1024

/** Uploads one file into the folder, stamped with its sourceId. */
async function uploadOne(t: string, folderId: string, item: DriveItem, blob: Blob, signal?: AbortSignal): Promise<void> {
  const meta = { name: item.fileName, parents: [folderId], appProperties: { weddingSource: item.sourceId } }
  const type = blob.type || 'image/jpeg'
  if (blob.size <= MULTIPART_MAX) {
    const boundary = `wedding${Math.random().toString(36).slice(2)}`
    const body = new Blob(
      [`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${type}\r\n\r\n`, blob, `\r\n--${boundary}--`],
      { type: `multipart/related; boundary=${boundary}` },
    )
    const r = await api('/files?uploadType=multipart&fields=id', { token: t, signal, method: 'POST', body, headers: { 'Content-Type': `multipart/related; boundary=${boundary}` } }, UPLOAD)
    if (!r.ok) throw new DriveError(`upload ${r.status}`)
    return
  }
  // Big files: resumable upload (start a session, then send the bytes).
  const start = await api('/files?uploadType=resumable&fields=id', {
    token: t,
    signal,
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': type, 'X-Upload-Content-Length': String(blob.size) },
    body: JSON.stringify(meta),
  }, UPLOAD)
  const loc = start.headers.get('Location')
  if (!start.ok || !loc) throw new DriveError(`upload start ${start.status}`)
  const put = await fetch(loc, { method: 'PUT', body: blob, signal, headers: { 'Content-Type': type } })
  if (put.status === 401) throw new DriveError('Your Google sign-in expired. Click “Save to Google Drive” again — photos already saved will be skipped.', 'expired')
  if (!put.ok) throw new DriveError(`upload ${put.status}`)
}

/**
 * Saves every item not yet in the folder. Three at a time; a photo that fails
 * is counted and the rest carry on. When `signal` is aborted no new photo is
 * started, but the ones already uploading are allowed to finish — otherwise
 * Google could still save a photo after we "cancelled" it and a quick re-run
 * would add it twice.
 */
export async function saveToDrive(
  t: string,
  folderId: string,
  items: DriveItem[],
  onProgress: (p: DriveProgress) => void,
  signal: AbortSignal,
): Promise<DriveProgress> {
  const already = await savedSourceIds(t, folderId, signal)
  const todo = items.filter((i) => !already.has(i.sourceId))
  const p: DriveProgress = { total: items.length, done: items.length - todo.length, uploaded: 0, skipped: items.length - todo.length, failed: 0 }
  onProgress({ ...p })
  let next = 0
  let fatal = null as DriveError | null
  const worker = async () => {
    while (!signal.aborted && !fatal && next < todo.length) {
      const item = todo[next++]
      try {
        const res = await fetch(item.url)
        if (!res.ok) throw new Error(`download ${res.status}`)
        await uploadOne(t, folderId, item, await res.blob())
        p.uploaded++
      } catch (e) {
        if (e instanceof DriveError && e.kind === 'expired') {
          fatal = e
          break
        }
        p.failed++
      }
      p.done++
      onProgress({ ...p })
    }
  }
  await Promise.all([worker(), worker(), worker()])
  if (fatal) throw fatal
  if (signal.aborted) throw new DriveError('Stopped. Photos already saved stay in Drive; run it again to add the rest.', 'cancelled')
  return p
}

export const driveFolderUrl = (id: string) => `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`

/** A safe Drive file name. */
export const cleanFileName = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150)
