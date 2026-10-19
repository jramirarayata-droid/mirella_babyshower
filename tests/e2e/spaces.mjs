// Many baby showers ("spaces") on one site: the sign-in & plans page at the root,
// each shower at /<slug>/ with the x-space header, plan locks for guests and admins,
// a switched-off shower, and the owner page. Mocked backend — nothing live is touched.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = process.argv[2].replace(/\/$/, '')
const OUT = process.argv[3] ?? '/tmp'
const API = 'https://mock.supabase.test'
const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const PLANS = [
  { id: 'sprout', name: 'Little Sprout', tagline: 'Everything you need to invite and RSVP', price_php: 999, guest_limit: 40, features: [], highlight: false, sort: 1 },
  { id: 'bundle', name: 'Sweet Bundle', tagline: 'The full guest experience', price_php: 1999, guest_limit: 120, features: ['looks_all', 'predictions', 'names', 'reveal', 'guest_photos', 'gallery', 'printables'], highlight: true, sort: 2 },
  { id: 'full', name: 'Full Celebration', tagline: 'Everything', price_php: 3499, guest_limit: null, features: ['looks_all', 'predictions', 'names', 'reveal', 'guest_photos', 'gallery', 'printables', 'raffle', 'big_screen', 'slideshow', 'music', 'seating', 'cohost'], highlight: false, sort: 3 },
]
const planJson = (id) => {
  const p = PLANS.find((x) => x.id === id)
  return { id: p.id, name: p.name, guestLimit: p.guest_limit, features: p.features }
}
const SPACES = {
  mirella: { id: '00000000-0000-0000-0000-000000000001', slug: 'mirella', title: 'Mir & Ella Baby Shower', isDefault: true, open: true, activeUntil: null, plan: planJson('full'), guests: 40 },
  'baby-cruz': { id: 'aaaaaaaa-0000-0000-0000-000000000002', slug: 'baby-cruz', title: 'Baby Cruz', isDefault: false, open: true, activeUntil: '2027-04-30', plan: planJson('sprout'), guests: 12 },
  'baby-lim': { id: 'bbbbbbbb-0000-0000-0000-000000000003', slug: 'baby-lim', title: 'Baby Lim', isDefault: false, open: false, activeUntil: null, plan: planJson('bundle'), guests: 0 },
}
const settings = {
  id: 'ws1', couple_names: 'Ana & Leo Cruz', baby_name: 'Baby Cruz', hero_title: 'Baby Cruz', wedding_date: '2027-03-13', story_text: 'A little one is on the way!',
  church_name: 'Sample Garden Venue', ceremony_time: '2:00 PM', rsvp_open: true, additional_info: [], entourage: [], motif_colors: [], sections: [],
  gallery_visible: false, video_visible: false, outfit_section_visible: false, program_visible: false, verse_visible: false,
  seating_config: { finder: { from: null, mode: 'visible', preassign: false } }, theme: { template: 'clouds-blue' },
}
let who = null // 'owner' | 'ana' | null
const headersSeen = new Set()
const ownerCalls = []

const exp = () => Math.floor(Date.now() / 1000) + 86400
const tokenFor = (sub) => {
  const payload = Buffer.from(JSON.stringify({ sub, role: 'authenticated', exp: exp() })).toString('base64url')
  return `e30.${payload}.sig`
}
const userFor = (u) => ({ id: u === 'owner' ? 'u-owner' : 'u-ana', aud: 'authenticated', role: 'authenticated', email: u === 'owner' ? 'owner@example.com' : 'ana@accounts.invalid', user_metadata: { username: u } })

async function handle(route) {
  const req = route.request()
  const url = new URL(req.url())
  const p = url.pathname
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
  const space = req.headers()['x-space'] ?? ''
  headersSeen.add(space || '(none)')
  const here = SPACES[space || 'mirella']
  const accept = req.headers()['accept'] ?? ''
  const rows = (list) => (accept.includes('vnd.pgrst.object') ? (list[0] ? json(list[0]) : json({ message: 'none' }, 406)) : json(list))

  if (p === '/auth/v1/token') {
    const body = JSON.parse(req.postData() || '{}')
    const user = body.email === 'ana@accounts.invalid' && body.password === 'cloud-bunny-1234' ? 'ana' : body.email === 'owner@example.com' && body.password === 'owner-pass-1' ? 'owner' : null
    if (!user) return json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400)
    who = user
    return json({ access_token: tokenFor(userFor(user).id), token_type: 'bearer', expires_in: 86400, expires_at: exp(), refresh_token: 'r', user: userFor(user) })
  }
  if (p.startsWith('/auth/v1/user')) return who ? json(userFor(who)) : json({ message: 'no user' }, 401)
  if (p.startsWith('/auth/v1/logout')) {
    who = null
    return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })
  }
  if (p.startsWith('/functions/v1/owner-users')) {
    ownerCalls.push(JSON.parse(req.postData() || '{}'))
    return json({ userId: 'u-new' })
  }
  if (p.startsWith('/rest/v1/rpc/')) {
    const fn = p.slice('/rest/v1/rpc/'.length)
    if (fn === 'space_here') return json(here ? { exists: true, ...here, guests: who ? here.guests : null } : { exists: false })
    if (fn === 'my_account') {
      if (who === 'owner') return json({ username: 'owner', displayName: 'Owner', superAdmin: true, spaces: [] })
      if (who === 'ana') return json({ username: 'ana', displayName: 'Ana Cruz', superAdmin: false, spaces: [{ ...SPACES['baby-cruz'], isActive: true }] })
      return json(null)
    }
    if (fn === 'touch_last_login') return json(null)
    if (fn === 'is_admin') return json(who === 'owner' || (who === 'ana' && space === 'baby-cruz'))
    if (fn === 'owner_spaces') {
      if (who !== 'owner') return json({ message: 'Not allowed', code: '42501' }, 403)
      return json(Object.values(SPACES).map((s) => ({ ...s, planId: s.plan.id, isActive: s.open, notes: '', createdAt: '2026-10-01', replies: 3, admins: s.slug === 'baby-cruz' ? [{ userId: 'u-ana', username: 'ana', displayName: 'Ana Cruz', lastLoginAt: null }] : [] })))
    }
    if (fn === 'owner_accounts') return json([{ userId: 'u-owner', username: 'owner', displayName: 'Owner', superAdmin: true, lastLoginAt: null, createdAt: '2026-10-01', spaces: ['mirella'] }, { userId: 'u-ana', username: 'ana', displayName: 'Ana Cruz', superAdmin: false, lastLoginAt: null, createdAt: '2026-10-02', spaces: ['baby-cruz'] }])
    if (fn === 'owner_save_space') {
      ownerCalls.push({ fn, ...JSON.parse(req.postData() || '{}') })
      return json('cccccccc-0000-0000-0000-000000000004')
    }
    if (fn === 'public_display_prefs') return json({ card: {}, website: {}, sharePreviewUrl: null, raffleVisible: false, monogram: null })
    if (fn === 'registry_list') return json({ visible: true, title: 'Gift Wishlist', intro: '', me: null, items: [] })
    if (fn === 'predictions_info') return json({ visible: true, open: true, closeAt: null, count: 0, me: null, mine: null })
    if (fn === 'name_ideas_info') return json({ visible: true, approval: 'instant', perGuest: 3, me: null, mine: [] })
    if (fn === 'public_gender_reveal') return json({ enabled: true, revealAt: new Date(Date.now() + 86400e3).toISOString(), revealed: false, answer: null, title: 'Boy or Girl?', message: '', now: new Date().toISOString() })
    return json(null)
  }
  const table = p.replace('/rest/v1/', '')
  if (table === 'plans') return json(PLANS)
  if (req.method() !== 'GET') return json(null, 204)
  if (table === 'wedding_settings') return rows([settings])
  return rows([])
}

const browser = await chromium.launch()
const shots = []
let page = null
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.route(`${API}/**`, handle)
  page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  // ------------------------------------------------------------ the root: sign in + plans
  await page.goto(`${BASE}/#/`)
  await page.getByRole('heading', { name: 'Sign in' }).waitFor({ timeout: 20000 })
  ok('root shows the sign-in card', await page.getByLabel('Username').isVisible())
  await page.getByRole('heading', { name: 'Little Sprout' }).waitFor({ timeout: 8000 })
  ok('root shows the three plans', (await page.getByRole('heading', { name: /^(Little Sprout|Sweet Bundle|Full Celebration)$/ }).count()) === 3)
  ok('plan prices show in pesos', (await page.getByText('₱1,999').count()) >= 1)
  shots.push(['spaces-landing', await page.screenshot({ fullPage: true })])
  ok('root sends no space header', headersSeen.has('(none)') && !headersSeen.has('baby-cruz'))

  // wrong password
  await page.getByLabel('Username').fill('ana')
  await page.getByLabel('Password').fill('nope-nope')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByText(/username or password is incorrect/i).waitFor({ timeout: 8000 })
  ok('a wrong password is refused kindly', true)

  // the customer signs in with a username and lands on her shower's dashboard
  await page.getByLabel('Password').fill('cloud-bunny-1234')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/baby-cruz\/#\/admin/, { timeout: 15000 })
  ok('username sign-in goes to /baby-cruz/#/admin', page.url().includes('/baby-cruz/#/admin'))
  await page.getByRole('heading', { name: 'Little Sprout' }).waitFor({ timeout: 15000 })
  ok('dashboard shows her plan', true)
  ok('dashboard shows guests used of the limit', (await page.getByText(/12\s*of 40/).count()) >= 1)
  ok('requests carry the x-space header', headersSeen.has('baby-cruz'))
  shots.push(['spaces-dashboard-sprout', await page.screenshot({ fullPage: true })])

  // locked admin page
  await page.goto(`${BASE}/baby-cruz/#/admin/predictions`)
  await page.getByText(/part of a bigger plan/i).waitFor({ timeout: 15000 })
  ok('Little Sprout: Predictions admin shows the upgrade card', true)
  shots.push(['spaces-admin-locked', await page.screenshot()])

  // guest side of a Little Sprout shower
  const g = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await g.route(`${API}/**`, handle)
  const gp = await g.newPage()
  gp.on('pageerror', (e) => errors.push(String(e)))
  await gp.goto(`${BASE}/baby-cruz/#/`)
  await gp.locator('h1, main').first().waitFor({ timeout: 20000 })
  await gp.waitForTimeout(2500)
  ok('guest home of a shower opens at its address', (await gp.getByText('Baby Cruz').count()) >= 1)
  ok('Little Sprout: no predictions card for guests', (await gp.getByRole('link', { name: /Make your guess/ }).count()) === 0)
  ok('Little Sprout: no gender reveal section', (await gp.locator('section[aria-labelledby="reveal-heading"]').count()) === 0)
  await gp.goto(`${BASE}/baby-cruz/#/predict`)
  await gp.getByText('Not part of this shower').waitFor({ timeout: 15000 })
  ok('Little Sprout: /predict tells guests it isn’t part of this shower', true)
  shots.push(['spaces-guest-sprout', await gp.screenshot()])

  // a switched-off shower
  await gp.goto(`${BASE}/baby-lim/#/`)
  await gp.getByText('This page is resting for now').waitFor({ timeout: 15000 })
  ok('a switched-off shower rests for guests', true)
  await gp.goto(`${BASE}/no-such-shower/#/`)
  await gp.getByText('We couldn’t find this baby shower').waitFor({ timeout: 15000 })
  ok('an unknown address says so', true)
  await g.close()

  // ------------------------------------------------------------ the owner
  await page.goto(`${BASE}/#/`)
  await page.waitForTimeout(1500)
  const out = page.getByRole('button', { name: 'Sign out' })
  if (await out.count()) await out.first().click()
  await page.getByLabel('Username').waitFor({ timeout: 10000 })
  await page.getByLabel('Username').fill('owner@example.com')
  await page.getByLabel('Password').fill('owner-pass-1')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('heading', { name: 'All baby showers' }).waitFor({ timeout: 15000 })
  ok('owner signs in to the owner page', true)
  ok('owner sees every shower', (await page.getByRole('heading', { name: /^(Mir & Ella Baby Shower|Baby Cruz|Baby Lim)$/ }).count()) === 3)
  shots.push(['spaces-owner', await page.screenshot({ fullPage: true })])

  await page.getByRole('button', { name: 'New shower' }).click()
  await page.getByLabel('Name').fill('Baby Reyes')
  ok('the web address follows the name', (await page.getByLabel('Web address').inputValue()) === 'baby-reyes')
  await page.getByText('Little Sprout').last().click()
  await page.getByRole('button', { name: 'Create shower' }).click()
  await page.waitForTimeout(1200)
  const saved = ownerCalls.find((c) => c.fn === 'owner_save_space')
  ok('creating a shower saves slug, plan and on/off', saved?.p_slug === 'baby-reyes' && saved?.p_plan === 'sprout' && saved?.p_active === true, JSON.stringify(saved))

  await page.getByRole('button', { name: 'New login' }).click()
  await page.getByLabel('Username').fill('reyes')
  await page.getByRole('button', { name: 'Create login' }).click()
  await page.getByText('Send this to your customer').waitFor({ timeout: 8000 })
  const made = ownerCalls.find((c) => c.action === 'create')
  ok('creating a login calls the server with username and a password', made?.username === 'reyes' && String(made?.password ?? '').length >= 8, JSON.stringify(made))
  ok('the message to send includes the username', (await page.getByText('Username: reyes').count()) === 1)
  shots.push(['spaces-owner-login', await page.screenshot()])

  ok('no page errors', errors.length === 0, errors.join(' | ').slice(0, 400))
} catch (e) {
  ok('test run', false, String(e).slice(0, 400))
  if (page) shots.push(['spaces-failure', await page.screenshot({ fullPage: true }).catch(() => Buffer.from(''))])
} finally {
  for (const [n, b] of shots) writeFileSync(`${OUT}/${n}.png`, b)
  await browser.close()
}
const passed = results.filter((r) => r.pass).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed === results.length ? 0 : 1)
