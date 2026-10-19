// Save to Google Drive (Admin → Guest Photos, Admin → Photos & Video), with Google sign-in and the
// Drive API replaced by an in-memory fake. Mocked backend — nothing live, nothing on Google is touched.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = process.argv[2]
const OUT = process.argv[3] ?? '/tmp'
const API = 'https://mock.supabase.test'
const CLIENT_ID = '123456789012-abcdefghijk.apps.googleusercontent.com'
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const T = '2026-12-19T10:42:00Z'
const settings = { id: 'ws1', couple_names: 'Mir & Ella', wedding_date: '2026-12-19', sections: [], additional_info: [], motif_colors: [], entourage: [], seating_config: { finder: { from: null, mode: 'visible', preassign: false } } }
const gp = (i, status = 'visible', name = `Guest ${i}`) => ({ id: `gp${String(i).padStart(4, '0')}-aaaa`, uploader_name: name, path: `p/${i}.jpg`, thumb_path: `t/${i}.jpg`, bytes: 500000, status, created_at: T, uploaded: true })
let guestPhotos = [gp(1, 'visible', 'Tita Baby'), gp(2, 'visible', 'Juan dela Cruz'), gp(3, 'hidden'), gp(4, 'pending'), gp(5, 'visible', 'Maria / Jose')]
const gallery = [
  { id: 'g1', image_url: `${API}/storage/v1/object/public/wedding-assets/gallery/a.jpg`, thumb_url: null, caption: 'At the beach', sort_order: 1, is_visible: true, section_id: null, created_at: T },
  { id: 'g2', image_url: `${API}/storage/v1/object/public/wedding-assets/gallery/b.png`, thumb_url: null, caption: '', sort_order: 2, is_visible: false, section_id: null, created_at: T },
  { id: 'g3', image_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1600', thumb_url: null, caption: 'sample', sort_order: 3, is_visible: true, section_id: null, created_at: T },
  { id: 'g4', image_url: `${API}/storage/v1/object/public/wedding-assets/gallery/big.jpg`, thumb_url: null, caption: 'Prenup', sort_order: 1, is_visible: true, section_id: 's1', created_at: T },
]
const sections = [{ id: 's1', kind: 'photos', title: 'Prenup Shoot', subtitle: '', layout: 'grid', video_url: '', poster_url: '', is_visible: true, sort_order: 1, created_at: T }]
const prefs = {} // admin_preferences
const prefWrites = []

// ---------------------------------------------------------------- fake Google
const drive = { files: [], seq: 0, uploads: 0, resumable: 0, delay: 0, expireAfter: null, scopes: [], tokenRequests: 0, sessions: {} }
const gisScript = `
  window.google = { accounts: { oauth2: { initTokenClient(cfg) {
    window.__gis = (window.__gis || []).concat([{ client_id: cfg.client_id, scope: cfg.scope }]);
    return { requestAccessToken() { setTimeout(() => cfg.callback({ access_token: 'tok-' + Date.now(), expires_in: 3600 }), 50) } };
  } } } };`

function multipartMeta(buf) {
  const text = buf.toString('utf8')
  const m = /\r\n\r\n(\{[\s\S]*?\})\r\n--/.exec(text)
  return m ? JSON.parse(m[1]) : null
}
async function handleGoogle(route) {
  const req = route.request()
  const url = new URL(req.url())
  const json = (body, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Location', ...headers }, body: JSON.stringify(body) })
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'Location' } })
  if (url.hostname === 'accounts.google.com') return route.fulfill({ status: 200, contentType: 'text/javascript', body: gisScript })
  const auth = req.headers()['authorization'] ?? ''
  if (req.method() !== 'PUT' && !auth.startsWith('Bearer tok-')) return json({ error: 'unauthorized' }, 401)
  if (drive.expireAfter !== null && drive.uploads >= drive.expireAfter && url.pathname.startsWith('/upload/')) return json({ error: 'expired' }, 401)
  const p = url.pathname
  if (p.startsWith('/drive/v3/files/') && req.method() === 'GET') {
    const f = drive.files.find((x) => x.id === decodeURIComponent(p.split('/').pop()))
    return f ? json({ id: f.id, trashed: false }) : json({ error: 'notFound' }, 404)
  }
  if (p === '/drive/v3/files' && req.method() === 'GET') {
    const q = url.searchParams.get('q') ?? ''
    const byName = /name='((?:\\'|[^'])*)'/.exec(q)
    const parent = /'([^']+)' in parents/.exec(q)
    let files = drive.files
    if (byName) files = files.filter((f) => f.mimeType === 'application/vnd.google-apps.folder' && f.name === byName[1].replace(/\\'/g, "'"))
    if (parent) files = files.filter((f) => f.parents?.includes(parent[1]))
    return json({ files: files.map((f) => ({ id: f.id, appProperties: f.appProperties })) })
  }
  if (p === '/drive/v3/files' && req.method() === 'POST') {
    const meta = JSON.parse(req.postData() || '{}')
    const f = { id: `folder${++drive.seq}`, ...meta }
    drive.files.push(f)
    return json({ id: f.id })
  }
  if (p === '/upload/drive/v3/files' && url.searchParams.get('uploadType') === 'multipart') {
    if (drive.delay) await new Promise((r) => setTimeout(r, drive.delay))
    const meta = multipartMeta(req.postDataBuffer())
    if (!meta) return json({ error: 'bad multipart' }, 400)
    drive.uploads++
    const f = { id: `file${++drive.seq}`, ...meta, size: req.postDataBuffer().length }
    drive.files.push(f)
    return json({ id: f.id })
  }
  if (p === '/upload/drive/v3/files' && url.searchParams.get('uploadType') === 'resumable' && req.method() === 'POST') {
    const id = `up${++drive.seq}`
    drive.sessions[id] = JSON.parse(req.postData() || '{}')
    return json({}, 200, { Location: `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=${id}` })
  }
  if (p === '/upload/drive/v3/files' && req.method() === 'PUT') {
    const meta = drive.sessions[url.searchParams.get('upload_id')]
    if (!meta) return json({ error: 'no session' }, 404)
    drive.uploads++
    drive.resumable++
    const f = { id: `file${++drive.seq}`, ...meta, size: req.postDataBuffer()?.length ?? 0 }
    drive.files.push(f)
    return json({ id: f.id })
  }
  return json({ error: `unhandled ${req.method()} ${p}` }, 400)
}

// ---------------------------------------------------------------- fake Supabase
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40_000, 7)])
const BIG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(5 * 1024 * 1024, 9)])
async function handle(route) {
  const req = route.request()
  const url = new URL(req.url())
  const p = url.pathname
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
  if (p.startsWith('/storage/v1/object/public/')) return route.fulfill({ status: 200, contentType: p.endsWith('.png') ? 'image/png' : 'image/jpeg', headers: { 'access-control-allow-origin': '*' }, body: p.endsWith('big.jpg') ? BIG : JPEG })
  const accept = req.headers()['accept'] ?? ''
  const rows = (list) => (accept.includes('vnd.pgrst.object') ? (list[0] ? json(list[0]) : json(null, 200)) : json(list))
  if (p.startsWith('/rest/v1/rpc/')) {
    const fn = p.slice('/rest/v1/rpc/'.length)
    if (fn === 'is_admin') return json(true)
    if (fn === 'public_display_prefs') return json({ card: {}, website: {}, sharePreviewUrl: null, raffleVisible: false, monogram: null })
    return json(null)
  }
  if (p.startsWith('/auth/v1/user')) return json({ id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' })
  const table = p.replace('/rest/v1/', '')
  if (table === 'admin_preferences') {
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}')
      const row = Array.isArray(body) ? body[0] : body
      prefs[row.key] = row.value
      prefWrites.push(row)
      return json(null, 201)
    }
    if (req.method() === 'GET') {
      const key = (url.searchParams.get('key') ?? '').replace(/^eq\./, '')
      return rows(key && prefs[key] !== undefined ? [{ value: prefs[key] }] : key ? [] : Object.entries(prefs).map(([k, v]) => ({ key: k, value: v })))
    }
  }
  if (req.method() !== 'GET') return json(null, 204)
  if (table === 'guest_photos') return rows(guestPhotos)
  if (table === 'gallery_images') return rows(gallery)
  if (table === 'media_sections') return rows(sections)
  if (table === 'wedding_settings') return rows([settings])
  return rows([])
}

const browser = await chromium.launch()
const shots = []
let page = null
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.route(`${API}/**`, handle)
  await ctx.route('https://accounts.google.com/**', handleGoogle)
  await ctx.route('https://www.googleapis.com/**', handleGoogle)
  let googleCalls = 0
  ctx.on('request', (r) => {
    if (/accounts\.google\.com|googleapis\.com\/(drive|upload)/.test(r.url())) googleCalls++
  })
  await ctx.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 86400
    const payload = btoa(JSON.stringify({ sub: 'u1', role: 'authenticated', exp })).replace(/=+$/, '')
    localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: `e30.${payload}.sig`, refresh_token: 'r', expires_at: exp, expires_in: 86400, token_type: 'bearer', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' } }))
  })
  page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  // Guests never load anything from Google.
  await page.goto(`${BASE}#/`)
  await page.waitForTimeout(2500)
  ok('the guest home page makes no Google calls', googleCalls === 0, `${googleCalls}`)

  // ================================================================ Guest Photos
  await page.goto(`${BASE}#/admin/guest-photos`)
  const button = page.getByRole('button', { name: 'Save to Google Drive' })
  await button.waitFor({ timeout: 20000 })
  ok('Guest Photos has a “Save to Google Drive” button', await button.isVisible())
  await button.click()
  const dialog = page.getByRole('dialog', { name: 'Save to Google Drive' })
  await dialog.waitFor()
  const idBox = dialog.getByLabel('Google Client ID')
  await idBox.waitFor({ timeout: 5000 })
  ok('first time: it asks for the Google Client ID', await idBox.isVisible())
  await idBox.fill('not-a-client-id')
  await dialog.getByRole('button', { name: 'Save Client ID' }).click()
  ok('a wrong-looking Client ID is caught', await dialog.getByText(/doesn’t look like a Google Client ID/).isVisible())
  await idBox.fill(CLIENT_ID)
  await dialog.getByRole('button', { name: 'Save Client ID' }).click()
  await page.waitForTimeout(500)
  ok('the Client ID is saved in the admin settings', prefs.google_drive?.clientId === CLIENT_ID, JSON.stringify(prefs.google_drive))
  ok('…and the window tells you to keep the page open', await dialog.getByText(/Keep this page open/).isVisible())
  shots.push(['drive-guest-ready', await dialog.screenshot()])

  await dialog.getByRole('button', { name: 'Start' }).click()
  await dialog.locator('[data-drive-done]').waitFor({ timeout: 20000 })
  const gis = await page.evaluate(() => window.__gis ?? [])
  ok('Google sign-in asks only for the drive.file permission', gis.length >= 1 && gis.every((g) => g.scope === 'https://www.googleapis.com/auth/drive.file' && g.client_id === CLIENT_ID), JSON.stringify(gis))
  const folder = drive.files.filter((f) => f.mimeType === 'application/vnd.google-apps.folder')
  ok('a Drive folder “Mir & Ella — Guest Photos” is made', folder.length === 1 && folder[0].name === 'Mir & Ella — Guest Photos', JSON.stringify(folder.map((f) => f.name)))
  const inFolder = () => drive.files.filter((f) => f.parents?.includes(folder[0]?.id))
  ok('only shown guest photos are saved (3 of 5)', inFolder().length === 3, `${inFolder().length}`)
  const names = inFolder().map((f) => f.name)
  ok('file names carry who shared the photo', names.some((n) => n.startsWith('Tita Baby — 2026-12-19 18.42')) && names.some((n) => n.startsWith('Juan dela Cruz')), names.join(' | '))
  ok('names are made safe for Drive (no “/”)', names.some((n) => n.startsWith('Maria Jose')) && names.every((n) => !n.includes('/')), names.join(' | '))
  ok('the window shows the result with a link to the folder', (await dialog.getByText('Saved 3 guest photos to Google Drive.').isVisible()) && (await dialog.getByRole('link', { name: /Open the folder in Google Drive/ }).getAttribute('href'))?.endsWith(folder[0].id))
  shots.push(['drive-guest-done', await dialog.screenshot()])
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })

  // Re-run: nothing new → nothing uploaded; one new photo → only that one.
  const before = drive.uploads
  await button.click()
  await dialog.getByRole('button', { name: 'Start' }).click()
  await dialog.locator('[data-drive-done]').waitFor({ timeout: 20000 })
  ok('running again uploads nothing that’s already there', drive.uploads === before && (await dialog.getByText('Everything was already in Google Drive.').isVisible()))
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
  guestPhotos = [gp(6, 'visible', 'Lola Nena'), ...guestPhotos]
  await button.click()
  await dialog.getByRole('button', { name: 'Start' }).click()
  await dialog.locator('[data-drive-done]').waitFor({ timeout: 20000 })
  ok('…and only adds new photos', drive.uploads === before + 1 && inFolder().length === 4, `${drive.uploads - before} new`)
  ok('the same folder is reused', drive.files.filter((f) => f.mimeType === 'application/vnd.google-apps.folder').length === 1)
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })

  // Cancel part-way, then finish later without duplicates.
  guestPhotos = [...Array.from({ length: 24 }, (_, i) => gp(100 + i, 'visible', `Guest ${100 + i}`)), ...guestPhotos]
  drive.delay = 350
  await button.click()
  await dialog.getByRole('button', { name: 'Start' }).click()
  await dialog.locator('[data-drive-progress]').waitFor({ timeout: 10000 })
  await page.waitForTimeout(900)
  // Closing or reloading the tab while it runs asks first.
  const asked = await page.evaluate(() => {
    const e = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(e)
    return e.defaultPrevented
  })
  ok('closing the tab while saving asks first', asked)
  shots.push(['drive-guest-progress', await page.screenshot()])
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await dialog.locator('[data-drive-stopped]').waitFor({ timeout: 10000 })
  const partial = inFolder().length
  ok('Cancel stops part-way', partial > 4 && partial < 28 && (await dialog.getByText(/Stopped/).isVisible()), `${partial} in folder`)
  drive.delay = 0
  await dialog.getByRole('button', { name: 'Try again' }).click()
  await dialog.locator('[data-drive-done]').waitFor({ timeout: 30000 })
  const sources = inFolder().map((f) => f.appProperties?.weddingSource)
  ok('finishing later saves the rest with no duplicates', inFolder().length === 28 && new Set(sources).size === 28, `${inFolder().length} files, ${new Set(sources).size} distinct`)
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })

  // Google sign-in expires mid-way: a clear message, nothing broken.
  guestPhotos = [gp(500, 'visible', 'Late Guest'), gp(501, 'visible', 'Later Guest'), ...guestPhotos]
  drive.expireAfter = drive.uploads + 1
  await button.click()
  await dialog.getByRole('button', { name: 'Start' }).click()
  await dialog.locator('[data-drive-stopped]').waitFor({ timeout: 20000 })
  ok('an expired Google sign-in gives a clear “click again” message', await dialog.getByText(/sign-in expired/).isVisible())
  drive.expireAfter = null
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })

  // ================================================================ Photos & Video
  await page.goto(`${BASE}#/admin/media`)
  const b2 = page.getByRole('button', { name: 'Save to Google Drive' })
  await b2.waitFor({ timeout: 20000 })
  ok('Photos & Video has a “Save to Google Drive” button', await b2.isVisible())
  await b2.click()
  await dialog.getByRole('button', { name: 'Start' }).click()
  await dialog.locator('[data-drive-done]').waitFor({ timeout: 30000 })
  const ours = drive.files.find((f) => f.name === 'Mir & Ella — Our Photos')
  const oursFiles = drive.files.filter((f) => f.parents?.includes(ours?.id))
  ok('a separate folder “Mir & Ella — Our Photos” is made', Boolean(ours))
  ok('your photos are saved, sample photos are not (3 of 4)', oursFiles.length === 3, oursFiles.map((f) => f.name).join(' | '))
  ok('names follow the gallery and its sections', oursFiles.some((f) => f.name === 'Our Photos — 001 — At the beach.jpg') && oursFiles.some((f) => f.name === 'Our Photos — 002.png') && oursFiles.some((f) => f.name === 'Prenup Shoot — 001 — Prenup.jpg'), oursFiles.map((f) => f.name).join(' | '))
  ok('a big photo (over 4 MB) goes up in full', drive.resumable === 1 && (oursFiles.find((f) => f.name.startsWith('Prenup Shoot'))?.size ?? 0) > 5_000_000)
  shots.push(['drive-ours-done', await dialog.screenshot()])

  ok('no page errors', errors.length === 0, errors.join(' | '))
} catch (e) {
  ok('test run', false, String(e).slice(0, 400))
  if (page) shots.push(['drive-failure', await page.screenshot().catch(() => Buffer.from(''))])
} finally {
  for (const [n, b] of shots) writeFileSync(`${OUT}/${n}.png`, b)
  await browser.close()
}
const passed = results.filter((r) => r.pass).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed === results.length ? 0 : 1)
