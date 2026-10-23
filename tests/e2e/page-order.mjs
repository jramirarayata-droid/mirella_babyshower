// Page Order (Admin → Page Order) and the page background (Look & Feel):
// the home page follows the saved order (front page first, footer last), the
// admin page lists every section with what it shows and saves a new order, and
// the background photo layer appears only when switched on. Mocked backend.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = process.argv[2]
const OUT = process.argv[3] ?? '/tmp'
const API = 'https://mock.supabase.test'
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const PIC = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#DCEAF7"/><circle cx="600" cy="400" r="260" fill="#F6D3DC"/></svg>')
const settings = {
  id: 'ws1', couple_names: 'Juan & Maria Santos', baby_name: 'Baby Santos', hero_title: 'Baby Santos', wedding_date: '2027-03-13', story_text: 'A little one is on the way!',
  church_name: 'Sample Garden Venue', ceremony_time: '2:00 PM', rsvp_open: true, entourage: [], sections: [],
  additional_info: [{ id: 'g1', title: 'Dress code', body: 'Comfy pastels, please.', icon: 'info', visible: true }],
  motif_colors: [{ id: 'm1', name: 'Baby Blue', hex: '#A9C8EA' }], motif_title: 'Our Colours',
  gallery_visible: false, video_visible: false, outfit_section_visible: false, program_visible: false, verse_visible: false,
  seating_config: { finder: { from: null, mode: 'hidden', preassign: false } }, theme: { template: 'clouds-blue' },
  page_order: ['intro', 'rsvp', 'venue'],
  venue_title: 'The Celebration', venue_eyebrow: 'Join us at',
  section_text: { intro: { eyebrow: 'Welcome, friends' }, info: { title: 'Little Things to Know' } },
}
const patches = []

async function handle(route) {
  const req = route.request()
  const url = new URL(req.url())
  const p = url.pathname
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
  const accept = req.headers()['accept'] ?? ''
  const rows = (list) => (accept.includes('vnd.pgrst.object') ? (list[0] ? json(list[0]) : json({ message: 'none' }, 406)) : json(list))
  if (p.startsWith('/rest/v1/rpc/')) {
    const fn = p.slice('/rest/v1/rpc/'.length)
    if (fn === 'is_admin') return json(true)
    if (fn === 'public_display_prefs') return json({ card: {}, website: {}, sharePreviewUrl: null, raffleVisible: false, monogram: null })
    return json(null)
  }
  if (p.startsWith('/auth/v1/user')) return json({ id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' })
  if (p.startsWith('/realtime') || p.startsWith('/storage')) return json({})
  const table = p.replace('/rest/v1/', '')
  if (table === 'wedding_settings' && req.method() === 'PATCH') {
    const body = JSON.parse(req.postData() || '{}')
    patches.push(body)
    Object.assign(settings, body)
    return rows([settings])
  }
  if (req.method() !== 'GET') return json(null, 204)
  return rows(table === 'wedding_settings' ? [settings] : [])
}

const top = (page, text) => page.getByText(text, { exact: false }).first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY)

const browser = await chromium.launch()
const shots = []
let current = null
try {
  // ---------------------------------------------------------------- the home page follows the saved order
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  await ctx.route(`${API}/**`, handle)
  const page = await ctx.newPage()
  current = page
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}#/`)
  await page.getByText(/Kindly respond/i).first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(1200)
  const rsvpY = await top(page, 'Kindly respond')
  const venueY = await top(page, 'Sample Garden Venue')
  const motifY = await top(page, 'Our Colours')
  ok('home: RSVP moved above the venue', rsvpY < venueY, `${rsvpY} < ${venueY}`)
  ok('home: sections not in the saved list keep their usual place after it', venueY < motifY, `${venueY} < ${motifY}`)
  ok('home: a section’s own small line shows', (await page.getByText('Welcome, friends', { exact: true }).count()) === 1)
  ok('home: the venue section uses its own title', (await page.getByRole('heading', { name: 'The Celebration' }).count()) === 1 && (await page.getByText('Join us at', { exact: true }).count()) === 1)
  ok('home: no page background unless switched on', (await page.locator('[data-page-background]').count()) === 0)
  shots.push(['page-order-home', await page.screenshot({ fullPage: true })])

  // ---------------------------------------------------------------- page background (uploaded photo)
  settings.theme = { template: 'clouds-blue', bgMode: 'upload', bgImage: 'https://example.com/bg.jpg', bgWash: 70 }
  await page.route('https://example.com/bg.jpg', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: decodeURIComponent(PIC.split(',')[1]) }))
  await page.reload()
  await page.getByText(/Kindly respond/i).first().waitFor({ timeout: 20000 })
  const layer = page.locator('[data-page-background]')
  ok('background: the photo layer is there when switched on', (await layer.count()) === 1)
  ok('background: it stays still (fixed) behind the page', (await layer.evaluate((el) => getComputedStyle(el).position)) === 'fixed')
  await page.mouse.wheel(0, 1500)
  await page.waitForTimeout(500)
  const box = await layer.boundingBox()
  ok('background: still covers the screen after scrolling', Boolean(box && box.y === 0 && box.height >= 800), JSON.stringify(box))
  await page.mouse.wheel(0, -3000)
  await page.waitForTimeout(400)
  const heroBgs = await page.locator('header.hero, header.hero .hero-paper').evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor))
  ok('background: shows through the front page when it has no photo', heroBgs.length > 0 && heroBgs.every((c) => c === 'rgba(0, 0, 0, 0)'), heroBgs.join(' | '))
  shots.push(['page-background', await page.screenshot()])
  settings.theme = { template: 'clouds-blue' }
  ok('no page errors (home)', errors.length === 0, errors.join(' | '))
  await ctx.close()

  // ---------------------------------------------------------------- Admin → Page Order
  const actx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await actx.route(`${API}/**`, handle)
  await actx.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 86400
    const payload = btoa(JSON.stringify({ sub: 'u1', role: 'authenticated', exp })).replace(/=+$/, '')
    localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: `e30.${payload}.sig`, refresh_token: 'r', expires_at: exp, expires_in: 86400, token_type: 'bearer', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' } }))
  })
  const a = await actx.newPage()
  current = a
  const aerr = []
  a.on('pageerror', (e) => aerr.push(String(e)))
  await a.goto(`${BASE}#/admin/page-order`)
  const list = a.getByRole('list').filter({ has: a.locator('[data-section]') })
  await list.waitFor({ timeout: 20000 })
  const keys = await list.locator('[data-section]').evaluateAll((els) => els.map((e) => e.getAttribute('data-section')))
  ok('admin: lists the sections in the saved order', keys[0] === 'intro' && keys.indexOf('rsvp') >= 0 && keys.indexOf('rsvp') + 1 === keys.indexOf('venue'), keys.join(','))
  ok('admin: says what each section shows', (await a.locator('[data-section="verse"]').getByText('Switched off').count()) === 1 && (await a.locator('[data-section="rsvp"]').getByText('Showing').count()) === 1)
  ok('admin: the menu has Page Order', (await a.getByRole('link', { name: 'Page Order' }).count()) >= 1)
  // Edit text: the RSVP title.
  await a.getByRole('button', { name: 'Edit the text of RSVP' }).click()
  const ed = a.locator('[data-text-editor="rsvp"]')
  await ed.waitFor({ timeout: 10000 })
  ok('admin: Edit text shows the usual words greyed out', (await ed.getByLabel('Title').getAttribute('placeholder')) === 'We would be honoured by your presence')
  await ed.getByLabel('Title').fill('Will you celebrate with us?')
  await ed.getByRole('button', { name: 'Save text' }).click()
  await a.waitForTimeout(800)
  const tp = patches.filter((x) => x.section_text).at(-1)
  ok('admin: the new title is saved, the other sections’ words are kept', tp?.section_text?.rsvp?.title === 'Will you celebrate with us?' && tp?.section_text?.intro?.eyebrow === 'Welcome, friends', JSON.stringify(tp?.section_text))
  // Venue: its words live in their own fields.
  await a.getByRole('button', { name: 'Edit the text of Venue & time' }).click()
  const ved = a.locator('[data-text-editor="venue"]')
  await ved.waitFor({ timeout: 10000 })
  ok('admin: the venue editor shows its current title', (await ved.getByLabel('Title', { exact: true }).inputValue()) === 'The Celebration')
  await ved.getByRole('button', { name: 'Cancel' }).click()
  await a.getByRole('button', { name: 'Move Venue & time up' }).click()
  await a.getByRole('button', { name: 'Save order' }).click()
  await a.waitForTimeout(800)
  const saved = patches.at(-1)?.page_order ?? []
  ok('admin: saves the new order', saved[0] === 'intro' && saved.indexOf('venue') >= 0 && saved.indexOf('venue') + 1 === saved.indexOf('rsvp'), saved.join(','))
  shots.push(['admin-page-order', await a.screenshot({ fullPage: true })])

  // Look & Feel: page background is off by default.
  await a.goto(`${BASE}#/admin/look`)
  const bg = a.getByRole('radiogroup', { name: 'Page background' })
  await bg.waitFor({ timeout: 20000 })
  ok('Look & Feel: page background starts as None', (await bg.getByRole('radio', { name: /None/ }).getAttribute('aria-checked')) === 'true')
  ok('Look & Feel: front-page photo needs a photo first', await bg.getByRole('radio', { name: /Front-page photo/ }).isDisabled())
  shots.push(['admin-page-background', await bg.screenshot()])
  ok('no page errors (admin)', aerr.length === 0, aerr.join(' | '))
  await actx.close()
} catch (e) {
  ok('script', false, String(e))
  if (current) shots.push(['page-order-failure', await current.screenshot({ fullPage: true }).catch(() => Buffer.alloc(0))])
} finally {
  await browser.close()
}
for (const [name, png] of shots) writeFileSync(`${OUT}/${name}.png`, png)
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
