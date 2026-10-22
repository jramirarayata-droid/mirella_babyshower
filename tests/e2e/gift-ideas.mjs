// Gift ideas: their own home-page section (cards or a gallery design), hidden
// when switched off or kept for attending guests, their own page, and the
// admin panel (Show / Hide, design, RSVP link switch). Mocked backend.
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

const PIC = (c) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="${c}"/></svg>`)
const settings = {
  id: 'ws1', couple_names: 'Juan & Maria Santos', baby_name: 'Baby Santos', hero_title: 'Baby Santos', wedding_date: '2027-03-13', story_text: 'A little one is on the way!',
  church_name: 'Sample Garden Venue', rsvp_open: true, entourage: [], sections: [], additional_info: [], motif_colors: [], seating_config: { finder: { from: null, mode: 'hidden', preassign: false } }, theme: { template: 'clouds-blue' },
}
const items = [
  { id: 'i1', title: 'Cloud nursery', note: 'Soft blues and stars', link: '', image: PIC('#DCEAF7') },
  { id: 'i2', title: 'Wooden toys', note: 'Simple and safe', link: 'https://example.com', image: PIC('#F6D3DC') },
]
let ideas = { visible: true, private: false, title: 'Gift Ideas', intro: '', layout: 'cards', items }
const saves = []
const regItems = [
  { id: 'i1', kind: 'idea', title: 'Cloud nursery', note: 'Soft blues', link: null, image_url: 'https://example.com/a.jpg', price_hint: null, quantity: 1, sort_order: 0, is_visible: true, created_at: '2026-09-01T00:00:00Z' },
  { id: 'g1', kind: 'gift', title: 'Diapers', note: null, link: null, image_url: null, price_hint: null, quantity: 3, sort_order: 1, is_visible: true, created_at: '2026-09-01T00:00:00Z' },
]

async function handle(route) {
  const req = route.request()
  const url = new URL(req.url())
  const p = url.pathname
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
  const accept = req.headers()['accept'] ?? ''
  const rows = (list) => (accept.includes('vnd.pgrst.object') ? (list[0] ? json(list[0]) : json(null)) : json(list))
  if (p.startsWith('/rest/v1/rpc/')) {
    const fn = p.slice('/rest/v1/rpc/'.length)
    if (fn === 'is_admin') return json(true)
    if (fn === 'public_display_prefs') return json({ card: {}, website: {}, sharePreviewUrl: null, raffleVisible: false, monogram: null })
    if (fn === 'gift_ideas_list') return json(ideas)
    if (fn === 'rsvp_extras') return json({})
    return json(null)
  }
  if (p.startsWith('/auth/v1/user')) return json({ id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' })
  if (p.startsWith('/realtime') || p.startsWith('/storage')) return json({})
  const table = p.replace('/rest/v1/', '')
  if (table === 'admin_preferences' && req.method() === 'POST') {
    saves.push(JSON.parse(req.postData() || '{}'))
    return json(null, 201)
  }
  if (req.method() !== 'GET') return json(null, 204)
  if (table === 'wedding_settings') return rows([settings])
  if (table === 'registry_items') return rows(regItems)
  if (table === 'admin_preferences') {
    const key = url.searchParams.get('key')
    if (key === 'eq.gift_ideas') return rows([{ value: { visible: true, title: 'Gift Ideas', intro: '', layout: 'cards' } }])
    return rows([])
  }
  return rows([])
}

const browser = await chromium.launch()
const shots = []
let current = null
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  await ctx.route(`${API}/**`, handle)
  const page = await ctx.newPage()
  current = page
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto(`${BASE}#/`)
  const heading = page.getByRole('heading', { name: 'Gift Ideas' })
  await heading.waitFor({ timeout: 20000 })
  ok('home: the ideas have their own section', (await heading.count()) === 1)
  ok('home: idea cards show title and caption', (await page.getByText('Cloud nursery').count()) >= 1 && (await page.getByText('Soft blues and stars').count()) >= 1)
  await heading.scrollIntoViewIfNeeded()
  shots.push(['ideas-cards', await page.screenshot()])

  ideas = { ...ideas, layout: 'polaroid' }
  await page.reload()
  await page.getByRole('heading', { name: 'Gift Ideas' }).waitFor({ timeout: 20000 })
  ok('home: a gallery design shows the photos', (await page.getByRole('list', { name: 'Gift Ideas' }).locator('img').count()) === 2)
  await page.getByRole('heading', { name: 'Gift Ideas' }).scrollIntoViewIfNeeded()
  shots.push(['ideas-polaroid', await page.screenshot()])

  ideas = { ...ideas, visible: false, items: [] }
  await page.reload()
  await page.getByText(/Kindly respond/i).first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(800)
  ok('home: switched off = no section', (await page.getByRole('heading', { name: 'Gift Ideas' }).count()) === 0)

  ideas = { visible: true, private: true, title: 'Gift Ideas', intro: '', layout: 'cards', items: [] }
  await page.reload()
  await page.getByText(/Kindly respond/i).first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(800)
  ok('home: attending guests only = not shown to others', (await page.getByRole('heading', { name: 'Gift Ideas' }).count()) === 0)
  await page.goto(`${BASE}#/ideas`)
  await page.getByText(/shared with the guests who are joining us/).waitFor({ timeout: 20000 })
  ok('page: asks others to RSVP first', true)

  ideas = { visible: true, private: false, title: 'Gift Ideas', intro: '', layout: 'cards', items }
  await page.reload()
  await page.getByText('Wooden toys').waitFor({ timeout: 20000 })
  ok('page: shows the ideas', (await page.getByText('Cloud nursery').count()) >= 1)
  ok('no page errors (guest)', errors.length === 0, errors.join(' | '))
  await ctx.close()

  // ------------------------------------------------------------ admin panel
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
  await a.goto(`${BASE}#/admin/registry`)
  const panel = a.getByRole('complementary', { name: 'Gift ideas section' })
  await panel.waitFor({ timeout: 20000 })
  await panel.getByRole('radio', { name: 'Hide' }).waitFor({ timeout: 20000 })
  await panel.getByRole('radio', { name: 'Hide' }).click()
  await panel.getByRole('radio', { name: /Polaroid wall/ }).click()
  await a.waitForTimeout(1200)
  const last = saves.filter((s) => s.key === 'gift_ideas').at(-1)?.value
  ok('admin: Hide and the design are saved', last?.visible === false && last?.layout === 'polaroid', JSON.stringify(last))
  ok('admin: each panel can keep it off the RSVP confirmation', (await a.getByText('Show on the RSVP confirmation').count()) === 2)
  shots.push(['admin-ideas', await panel.screenshot()])
  ok('no page errors (admin)', aerr.length === 0, aerr.join(' | '))
  await actx.close()
} catch (e) {
  ok('script', false, String(e))
  if (current) shots.push(['gift-ideas-failure', await current.screenshot({ fullPage: true }).catch(() => Buffer.alloc(0))])
} finally {
  await browser.close()
}
for (const [name, png] of shots) writeFileSync(`${OUT}/${name}.png`, png)
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
