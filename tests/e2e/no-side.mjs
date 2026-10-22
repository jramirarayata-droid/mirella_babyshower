// "No side": open-link sign-ups are on neither Dad's nor Mom's side. The
// Invitations page shows them with a "No side" badge, a "No side" filter and
// count. Mocked backend — nothing live is touched.
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

const T = '2026-09-01T00:00:00Z'
const inv = (id, name, code, extra = {}) => ({ id, invitee_name: name, search_name: name.toLowerCase(), invitation_code: code, table_number: null, max_additional_guests: 0, is_active: true, created_at: T, updated_at: T, table_id: null, printed_at: null, position_mode: 'auto', position_label: null, side: 'bride', addressed_as: null, source: 'list', ...extra })
const invitations = [
  inv('inv-a', 'Ana Reyes', 'ANA111'),
  inv('inv-b', 'Ben Cruz', 'BEN111', { side: 'groom' }),
  inv('inv-l', 'Lia Santos', 'LIA111', { side: 'none', source: 'link' }),
]
const settings = { id: 'ws1', couple_names: 'Juan & Maria Santos', baby_name: 'Baby Santos', wedding_date: '2027-03-13', rsvp_open: true, entourage: [], sections: [], additional_info: [], motif_colors: [] }

async function handle(route) {
  const req = route.request()
  const p = new URL(req.url()).pathname
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
  if (req.method() !== 'GET') return json(null, 204)
  if (table === 'wedding_settings') return rows([settings])
  if (table === 'invitations') return rows(invitations)
  return rows([])
}

const browser = await chromium.launch()
const shots = []
let current = null
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await ctx.route(`${API}/**`, handle)
  await ctx.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 86400
    const payload = btoa(JSON.stringify({ sub: 'u1', role: 'authenticated', exp })).replace(/=+$/, '')
    localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: `e30.${payload}.sig`, refresh_token: 'r', expires_at: exp, expires_in: 86400, token_type: 'bearer', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' } }))
  })
  const page = await ctx.newPage()
  current = page
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}#/admin/invitations`)
  await page.getByText('Lia Santos').first().waitFor({ timeout: 20000 })
  const row = page.getByRole('row').filter({ hasText: 'Lia Santos' })
  ok('the link sign-up shows "No side"', (await row.getByText('No side', { exact: true }).count()) === 1)
  ok('the others keep Mom / Dad', (await page.getByRole('row').filter({ hasText: 'Ana Reyes' }).getByText('Mom', { exact: true }).count()) === 1 && (await page.getByRole('row').filter({ hasText: 'Ben Cruz' }).getByText('Dad', { exact: true }).count()) === 1)
  ok('the head count lists No side', /No side\s*1/.test(await page.getByRole('region', { name: 'Expected headcount' }).innerText()))
  const tab = page.getByRole('tab', { name: /No side/ }).or(page.getByRole('button', { name: /No side/ })).or(page.getByRole('radio', { name: /No side/ })).first()
  await tab.click()
  await page.waitForTimeout(400)
  const shown = await page.getByRole('row').filter({ hasText: /Ana Reyes|Ben Cruz|Lia Santos/ }).allInnerTexts()
  ok('the "No side" filter shows only them', shown.length === 1 && shown[0].includes('Lia Santos'), shown.join(' | '))
  shots.push(['no-side', await page.screenshot({ fullPage: true })])
  ok('no page errors', errors.length === 0, errors.join(' | '))
  await ctx.close()
} catch (e) {
  ok('script', false, String(e))
  if (current) shots.push(['no-side-failure', await current.screenshot({ fullPage: true }).catch(() => Buffer.alloc(0))])
} finally {
  await browser.close()
}
for (const [name, png] of shots) writeFileSync(`${OUT}/${name}.png`, png)
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
