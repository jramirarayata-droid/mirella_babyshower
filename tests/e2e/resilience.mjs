// Resilience: the friendly error page (guests and admin, and a failed page download after an update),
// and Find My Seat with no signal (seat saved on the phone + the offline helper). Mocked backend.
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
const settings = {
  id: 'ws1', couple_names: 'Mir & Ella', wedding_date: '2026-12-19', church_name: 'San Agustin Church', ceremony_time: '2:00 PM',
  church_map_url: 'https://maps.google.com/?q=church', reception_name: 'The Glass Garden', reception_time: '5:00 PM', rsvp_open: true,
  sections: [], additional_info: [], motif_colors: [], entourage: [], seating_config: { finder: { from: null, mode: 'visible', preassign: false } },
}
const invitations = [{ id: 'inv-1', invitee_name: 'Juan dela Cruz', search_name: 'juan dela cruz', invitation_code: 'JUAN1', table_number: null, max_additional_guests: 0, is_active: true, created_at: T, updated_at: T, table_id: 't1', printed_at: null, position_mode: 'auto', position_label: null, side: 'groom', addressed_as: null }]
const seatResult = {
  status: 'seated', name: 'Juan dela Cruz', tableId: 't1', tableName: 'Table 5', seat: 2, rsvp: 'attending', party: [{ seat: 2, name: 'Juan dela Cruz' }],
  layout: { room: { width: 1200, height: 800 }, canvas: {}, tables: [{ id: 't1', name: 'Table 5', shape: 'round', capacity: 10, seatSides: 'all', x: 400, y: 300, width: 170, height: 170, rotation: 0 }], items: [] },
}
let seatCalls = 0
// When true, the pretend server is unreachable (Playwright would otherwise still answer while "offline").
let noSignal = false

async function handle(route) {
  if (noSignal) return route.abort('internetdisconnected')
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
    if (fn === 'find_my_seat') {
      seatCalls++
      return json(seatResult)
    }
    return json(null)
  }
  if (p.startsWith('/auth/v1/user')) return json({ id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' })
  const table = p.replace('/rest/v1/', '')
  if (req.method() !== 'GET') return json(null, 204)
  return rows(table === 'wedding_settings' ? [settings] : table === 'invitations' ? invitations : [])
}
const login = () => {
  const exp = Math.floor(Date.now() / 1000) + 86400
  const payload = btoa(JSON.stringify({ sub: 'u1', role: 'authenticated', exp })).replace(/=+$/, '')
  localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: `e30.${payload}.sig`, refresh_token: 'r', expires_at: exp, expires_in: 86400, token_type: 'bearer', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' } }))
}

const browser = await chromium.launch()
const shots = []
let page = null
try {
  // ================================================================ friendly error page
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await ctx.route(`${API}/**`, handle)
    await ctx.addInitScript(login)
    page = await ctx.newPage()

    // Guest page breaks after the site has loaded: names and venues still show.
    await page.goto(`${BASE}#/`)
    await page.locator('h1').first().waitFor({ timeout: 20000 })
    await page.waitForTimeout(800)
    await page.evaluate(() => (window.location.hash = '#/seat?crashtest'))
    const fallback = page.locator('[data-page-error]')
    await fallback.waitFor({ timeout: 8000 })
    const text = await fallback.innerText()
    ok('a broken guest page shows the friendly page, not a blank screen', /Something went wrong on this page/.test(text))
    ok('…with your names, the ceremony and the reception', /Mir & Ella/.test(text) && /San Agustin Church/.test(text) && /The Glass Garden/.test(text), text.slice(0, 160))
    shots.push(['resilience-guest-error', await page.screenshot()])
    await page.evaluate(() => (window.__crashArmed = false))
    await page.getByRole('button', { name: 'Try again' }).click()
    await page.getByRole('heading', { name: 'Find My Seat' }).waitFor({ timeout: 8000 }).catch(() => {})
    ok('“Try again” brings the page back', await page.getByRole('heading', { name: 'Find My Seat' }).isVisible())

    // "Go to the home page" from a page that broke on first load.
    await page.goto(`${BASE}#/rsvp?crashtest`)
    await page.reload()
    await fallback.waitFor({ timeout: 15000 })
    await page.evaluate(() => (window.__crashArmed = false))
    await page.getByRole('link', { name: 'Go to the home page' }).click()
    await page.locator('.hero-names').first().waitFor({ timeout: 10000 }).catch(() => {})
    ok('“Go to the home page” works', await page.locator('.hero-names').first().isVisible())

    // An admin page breaks: the menu stays, with its own message.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE}#/admin/invitations?crashadmin`)
    await page.reload()
    await page.locator('[data-page-error]').waitFor({ timeout: 20000 })
    const adminText = await page.locator('[data-page-error]').innerText()
    ok('a broken admin page shows its own message', /This page ran into a problem/.test(adminText) && /Nothing you saved has been lost/.test(adminText))
    ok('…and the admin menu is still there', await page.getByRole('navigation', { name: 'Admin' }).isVisible())
    shots.push(['resilience-admin-error', await page.screenshot()])
    await page.evaluate(() => (window.__crashArmed = false))
    await page.getByRole('button', { name: 'Try again' }).click()
    await page.waitForTimeout(1500)
    ok('“Try again” brings the admin page back', (await page.locator('[data-page-error]').count()) === 0)
    await ctx.close()
  }

  // ================================================================ a page file fails to download (e.g. just after an update)
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await ctx.route(`${API}/**`, handle)
    page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`${BASE}#/`)
    await page.locator('h1').first().waitFor({ timeout: 20000 })
    // Every request for the Find My Seat page file now fails.
    let blocked = 0
    await page.route('**/assets/FindSeat-*.js', (r) => {
      blocked++
      return r.abort()
    })
    await page.evaluate(() => (window.location.hash = '#/seat'))
    await page.locator('[data-page-error]').waitFor({ timeout: 20000 }).catch(() => {})
    ok('a page file that can’t download shows the friendly page (after one automatic reload)', await page.locator('[data-page-error]').isVisible(), `file requested ${blocked}×`)
    await ctx.close()
  }

  // ================================================================ Find My Seat without signal
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await ctx.route(`${API}/**`, handle)
    await ctx.addInitScript(() => localStorage.setItem('sw-test', '1'))
    page = await ctx.newPage()
    await page.goto(`${BASE}#/seat`)
    await page.getByRole('heading', { name: 'Find My Seat' }).waitFor({ timeout: 20000 })
    const sw = await page.evaluate(async () => {
      const r = await Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((res) => setTimeout(() => res(false), 8000))])
      return r
    })
    ok('the offline helper starts', sw === true)
    ok('the page tells guests to look their seat up before leaving home', await page.locator('[data-offline-tip]').isVisible())
    // Load once more under the helper so the page's own files are kept.
    await page.reload()
    await page.getByRole('heading', { name: 'Find My Seat' }).waitFor({ timeout: 20000 })
    await page.locator('main input').first().fill('Juan dela Cruz')
    await page.locator('main input').first().press('Enter')
    await page.getByText('Table 5').first().waitFor({ timeout: 10000 })
    ok('online: the seat is found', await page.getByText('Table 5').first().isVisible())
    ok('…and the guest is told it’s saved on their phone', await page.getByText(/Saved on this phone/).isVisible())

    // No signal at the venue.
    await ctx.setOffline(true)
    noSignal = true
    const callsBefore = seatCalls
    await page.reload()
    await page.locator('[data-saved-seat]').waitFor({ timeout: 15000 }).catch(() => {})
    ok('offline: Find My Seat still opens', await page.getByRole('heading', { name: 'Find My Seat' }).isVisible())
    ok('offline: it shows the saved seat with a “no signal” note', await page.locator('[data-saved-seat]').isVisible() && (await page.getByText('Table 5').first().isVisible()))
    ok('offline: nothing was fetched from the server', seatCalls === callsBefore)
    shots.push(['resilience-offline-seat', await page.screenshot({ fullPage: true })])

    // What the helper keeps on the phone: only the site's own files and fonts — no data.
    const kept = await page.evaluate(async () => {
      const out = []
      for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(r.url)
      return out
    })
    const allowed = (u) => {
      const x = new URL(u)
      return (x.origin === new URL(BASE).origin && (x.pathname === '/' || x.pathname.startsWith('/assets/'))) || /fonts\.(googleapis|gstatic)\.com$/.test(x.hostname)
    }
    ok('only the site’s own files and fonts are kept — no wedding or admin data', kept.length > 0 && kept.every(allowed), kept.filter((u) => !allowed(u)).slice(0, 3).join(' | ') || `${kept.length} files kept`)

    // Back online: fresh information wins over the saved copy.
    await ctx.setOffline(false)
    noSignal = false
    await page.reload()
    await page.getByRole('heading', { name: 'Find My Seat' }).waitFor({ timeout: 15000 })
    await page.waitForTimeout(2500)
    ok('back online: the seat is looked up fresh, not from the saved copy', seatCalls > callsBefore && (await page.locator('[data-saved-seat]').count()) === 0, `look-ups ${seatCalls - callsBefore}`)
    await ctx.close()
  }
} catch (e) {
  ok('test run', false, String(e).slice(0, 400))
  if (page) shots.push(['resilience-failure', await page.screenshot().catch(() => Buffer.from(''))])
} finally {
  for (const [n, b] of shots) writeFileSync(`${OUT}/${n}.png`, b)
  await browser.close()
}
const passed = results.filter((r) => r.pass).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed === results.length ? 0 : 1)
