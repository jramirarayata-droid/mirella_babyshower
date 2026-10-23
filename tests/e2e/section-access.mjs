// "Who sees it": one choice per section (Hidden, Website, Website + invitation,
// Invited guests only, Attending guests only). The admin saves it; a guest who
// isn't allowed is asked for their name (invited) instead of seeing the page.
// Mocked backend — nothing live is touched.
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

const settings = { id: 'ws1', couple_names: 'Juan & Maria Santos', baby_name: 'Baby Santos', wedding_date: '2027-03-13', rsvp_open: true, entourage: [], sections: [], additional_info: [], motif_colors: [] }
const prefs = { predictions: { mode: 'visible' }, section_access: null }
const saves = []
let who = 'invite'
const sections = () => {
  const one = (w, on = true) => ({ who: w, on, open: w === 'website' || w === 'website_invite' })
  return { registry: { ...one('website'), tab: 'list' }, attire: one('website'), reveal: one('website', false), predictions: one(who), names: one('website', false) }
}

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
    if (fn === 'guest_sections') return json(sections())
    if (fn === 'predictions_info') return json({ visible: false, private: true, open: false, count: 0, me: null, mine: null })
    if (fn === 'predictions_board') return json({ visible: false })
    if (fn === 'shower_guest_start') return json({ ok: false, reason: 'not_found' })
    return json(null)
  }
  if (p.startsWith('/auth/v1/user')) return json({ id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' })
  if (p.startsWith('/realtime') || p.startsWith('/storage')) return json({})
  const table = p.replace('/rest/v1/', '')
  if (table === 'admin_preferences' && req.method() === 'POST') {
    const body = JSON.parse(req.postData() || '{}')
    saves.push(body)
    prefs[body.key] = body.value
    return json(null, 201)
  }
  if (req.method() !== 'GET') return json(null, 204)
  if (table === 'wedding_settings') return rows([settings])
  if (table === 'admin_preferences') {
    const key = (url.searchParams.get('key') ?? '').replace('eq.', '')
    return rows(prefs[key] ? [{ value: prefs[key] }] : [])
  }
  return rows([])
}

const browser = await chromium.launch()
const shots = []
let current = null
try {
  // ------------------------------------------------------------ admin: Baby Predictions
  const actx = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
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
  await a.goto(`${BASE}#/admin/predictions`)
  const group = a.getByRole('radiogroup', { name: 'Who sees it' })
  await group.getByRole('radio', { name: /^Website Default/ }).waitFor({ timeout: 20000 })
  await a.waitForTimeout(600)
  const names = await group.getByRole('radio').allInnerTexts()
  ok('admin: five choices', names.length === 5, names.map((n) => n.split('\n')[0]).join(' | '))
  ok('admin: Website by default', (await group.getByRole('radio', { name: /^Website Default/ }).getAttribute('aria-checked')) === 'true')
  ok('admin: “When it starts” shows while it isn’t hidden', (await a.getByLabel('When it starts').count()) === 1)
  await group.getByRole('radio', { name: /Invited guests only/ }).click()
  await a.waitForTimeout(800)
  ok('admin: Invited guests only is saved', saves.some((x) => x.key === 'section_access' && x.value?.predictions === 'invite'), JSON.stringify(saves.at(-1)))
  await group.getByRole('radio', { name: /^Hidden/ }).click()
  await a.waitForTimeout(1200)
  ok('admin: Hidden switches the section off', saves.some((x) => x.key === 'predictions' && x.value?.mode === 'hidden'), JSON.stringify(saves.filter((x) => x.key === 'predictions').at(-1)))
  ok('admin: “When it starts” is gone while hidden', (await a.getByLabel('When it starts').count()) === 0)
  shots.push(['section-access-admin', await group.screenshot()])
  ok('no page errors (admin)', aerr.length === 0, aerr.join(' | '))
  await actx.close()

  // ------------------------------------------------------------ guest: kept for invited guests
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await ctx.route(`${API}/**`, handle)
  const g = await ctx.newPage()
  current = g
  const gerr = []
  g.on('pageerror', (e) => gerr.push(String(e)))
  await g.goto(`${BASE}#/predict`)
  await g.getByText(/is for our invited guests/).waitFor({ timeout: 20000 })
  ok('guest: invited-only asks for their name', (await g.getByLabel('Your full name').count()) === 1)
  who = 'attending'
  await g.reload()
  await g.getByText(/shared with the guests who are joining us/).waitFor({ timeout: 20000 })
  ok('guest: attending-only asks them to RSVP', (await g.getByRole('link', { name: 'RSVP' }).count()) >= 1)
  shots.push(['section-access-guest', await g.screenshot()])
  ok('no page errors (guest)', gerr.length === 0, gerr.join(' | '))
  await ctx.close()
} catch (e) {
  ok('script', false, String(e))
  if (current) shots.push(['section-access-failure', await current.screenshot({ fullPage: true }).catch(() => Buffer.alloc(0))])
} finally {
  await browser.close()
}
for (const [name, png] of shots) writeFileSync(`${OUT}/${name}.png`, png)
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
