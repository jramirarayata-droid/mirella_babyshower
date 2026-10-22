// "How guests RSVP": the open link. A guest who isn't on any list types their
// name, gets their invitation, replies with a mobile number and companions
// (names required; they wait for approval) — saved through open_rsvp_submit.
// The same name again is treated as a returning guest. In the admin, the open
// link can't be chosen while the guest list has names. Mocked backend.
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

const off = { enabled: false }
const settings = {
  id: 'ws1', couple_names: 'Juan & Maria Santos', baby_name: 'Baby Santos', hero_title: 'Baby Santos', wedding_date: '2027-03-13', story_text: 'A little one is on the way!',
  church_name: 'Sample Garden Venue', ceremony_time: '2:00 PM', rsvp_open: true, additional_info: [], entourage: [], motif_colors: [], sections: [],
  gallery_visible: false, video_visible: false, outfit_section_visible: false, program_visible: false, verse_visible: false,
  seating_config: { finder: { from: null, mode: 'hidden', preassign: false } }, theme: { template: 'clouds-blue' },
  rsvp_config: { builtins: { transportation: off, comingFrom: off, food: off, dietary: off, accessibility: off, message: off } },
  rsvp_mode: 'open', open_rsvp_companions: 2,
}
const calls = []
// Names already here (a returning guest).
const existing = { 'lia cruz': { invitation_id: 'inv-lia', invitee_name: 'Lia Cruz', table_number: null, max_additional_guests: 2, has_existing_response: true, included_guests: [] } }
let listedNames = 3

async function handle(route) {
  const req = route.request()
  const url = new URL(req.url())
  const p = url.pathname
  const json = (body, status = 200, headers = {}) =>
    route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...headers }, body: JSON.stringify(body) })
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
  const accept = req.headers()['accept'] ?? ''
  const rows = (list) => (accept.includes('vnd.pgrst.object') ? (list[0] ? json(list[0]) : json({ message: 'none' }, 406)) : json(list))
  if (p.startsWith('/rest/v1/rpc/')) {
    const fn = p.slice('/rest/v1/rpc/'.length)
    const a = JSON.parse(req.postData() || '{}')
    calls.push({ fn, a })
    if (fn === 'find_invitation') {
      const hit = existing[String(a.search_name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()]
      return json(hit ? [hit] : [])
    }
    if (fn === 'find_included_guest') return json([])
    if (fn === 'suggest_guest_name') return json(/^lea cruz$/i.test(String(a.search_name ?? '').trim()) ? 'Lia Cruz' : null)
    if (fn === 'open_rsvp_submit') return json([{ rsvp_id: 'r-new', attendance_status: a.p_attendance_status, invitation_id: 'inv-new' }])
    if (fn === 'submit_rsvp') return json([{ rsvp_id: 'r-lia', attendance_status: a.p_attendance_status }])
    if (fn === 'shower_guest_start') return json({ ok: true, token: 't'.repeat(40), name: 'Mark Reyes' })
    if (fn === 'is_admin') return json(true)
    if (fn === 'public_display_prefs') return json({ card: {}, website: {}, sharePreviewUrl: null, raffleVisible: false, monogram: null })
    if (fn === 'admin_clear_guest_list') {
      const n = listedNames
      listedNames = 0
      return json(n)
    }
    return json(null)
  }
  if (p.startsWith('/auth/v1/user')) return json({ id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' })
  if (p.startsWith('/realtime') || p.startsWith('/storage')) return json({})
  const table = p.replace('/rest/v1/', '')
  if (req.method() === 'HEAD') {
    const n = table === 'invitations' && url.searchParams.get('source') === 'eq.list' ? listedNames : 0
    return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', 'content-range': n ? `0-${n - 1}/${n}` : '*/0' } })
  }
  if (table === 'wedding_settings' && req.method() === 'PATCH') {
    const body = JSON.parse(req.postData() || '{}')
    calls.push({ fn: 'wedding_settings:patch', a: body })
    if (body.rsvp_mode === 'open' && listedNames > 0) return json({ message: 'Remove the 3 listed guests before switching to an open link.', hint: 'rsvp_mode_list_not_empty', code: 'P0001' }, 400)
    Object.assign(settings, body)
    return rows([settings])
  }
  if (req.method() !== 'GET') return json(null, 204)
  return rows(table === 'wedding_settings' ? [settings] : [])
}

const browser = await chromium.launch()
const shots = []
let current = null
try {
  // ---------------------------------------------------------------- a new guest signs up through the open link
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
  await ctx.route(`${API}/**`, handle)
  const page = await ctx.newPage()
  current = page
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}#/rsvp`)
  await page.getByRole('heading', { name: 'Your RSVP' }).waitFor({ timeout: 20000 })
  ok('open link: the page asks for your name, not a guest-list search', (await page.getByText('Please type your first and last name.').count()) >= 1)
  const box = page.getByRole('textbox').first()
  ok('open link: the button says Continue', (await page.getByRole('button', { name: 'Continue', exact: true }).count()) === 1)
  await box.fill('Mark')
  await box.press('Enter')
  await page.getByText('Please add your last name too.').waitFor({ timeout: 10000 })
  ok('a first name alone asks for the last name (no search yet)', !calls.some((c) => c.fn === 'find_invitation'))
  shots.push(['open-rsvp-last-name', await page.screenshot({ fullPage: true })])
  await box.fill('Mark  Reyes')
  await box.press('Enter')
  // A new name goes straight to their own invitation (envelope → card), then the form.
  await page.getByRole('button', { name: /Open your invitation/ }).waitFor({ timeout: 20000 })
  ok('a new name goes straight to the invitation (no extra step, no red message)', (await page.getByText(/don’t have a reply/).count()) === 0)
  shots.push(['open-rsvp-new-guest', await page.screenshot({ fullPage: true })])
  await page.getByRole('button', { name: /Open your invitation/ }).click({ timeout: 20000 })
  await page.getByRole('button', { name: 'Continue to RSVP' }).click({ timeout: 20000 })
  await page.getByText('Will you be joining us?').waitFor({ timeout: 10000 })
  await page.getByText('Joyfully, I’ll be there!').or(page.getByText("Joyfully, I'll be there!")).first().click()
  await page.locator('#mobile-number').fill('0917 123 4567')
  await page.getByRole('radio', { name: 'Yes' }).first().check({ force: true })
  await page.getByLabel(/Additional Guest/).first().fill('Ana Reyes')
  ok('companions: up to the limit the customer set', (await page.getByText(/up to 2 additional/).count()) >= 1)
  shots.push(['open-rsvp-form', await page.screenshot({ fullPage: true })])
  await page.getByRole('button', { name: 'Confirm My Response' }).click()
  await page.getByRole('button', { name: 'Confirm Response' }).click()
  await page.getByText(/Thank you, Mark/).waitFor({ timeout: 15000 })
  const sent = calls.find((c) => c.fn === 'open_rsvp_submit')
  ok('saved as an open sign-up with name, mobile and companion', sent?.a.p_name === 'Mark Reyes' && sent?.a.p_attendance_status === 'attending' && /9171234567/.test(sent?.a.p_mobile_number ?? '') && sent?.a.p_additional_guests?.[0] === 'Ana Reyes', JSON.stringify(sent?.a))
  ok('not saved through the guest-list function', !calls.some((c) => c.fn === 'submit_rsvp'))
  ok('companion request is acknowledged', (await page.getByText(/additional guest request/).count()) === 1)
  shots.push(['open-rsvp-success', await page.screenshot({ fullPage: true })])

  // ---------------------------------------------------------------- the same name again: a returning guest, no new sign-up
  await page.goto(`${BASE}#/`)
  await page.goto(`${BASE}#/rsvp`)
  await page.getByRole('heading', { name: 'Your RSVP' }).waitFor({ timeout: 20000 })
  const box2 = page.getByRole('textbox').first()
  await box2.fill('Lia Cruz')
  await box2.press('Enter')
  await page.getByRole('button', { name: /Open your invitation/ }).waitFor({ timeout: 15000 })
  ok('a name already here opens their own invitation', true)
  // A close spelling of someone already here: asked once.
  await page.goto(`${BASE}#/`)
  await page.goto(`${BASE}#/rsvp`)
  await page.getByRole('heading', { name: 'Your RSVP' }).waitFor({ timeout: 20000 })
  const box3 = page.getByRole('textbox').first()
  await box3.fill('Lea Cruz')
  await box3.press('Enter')
  await page.getByText('Is this you — Lia Cruz?').waitFor({ timeout: 10000 })
  shots.push(['open-rsvp-maybe', await page.screenshot({ fullPage: true })])
  await page.getByRole('button', { name: 'No, I’m new — continue as Lea Cruz' }).click()
  await page.getByRole('button', { name: /Open your invitation/ }).waitFor({ timeout: 15000 })
  ok('close spelling: “No, I’m new” continues as the typed name', true)
  ok('no page errors (guest)', errors.length === 0, errors.join(' | '))
  await ctx.close()

  // ---------------------------------------------------------------- admin: the open link needs an empty guest list
  settings.rsvp_mode = 'list'
  const actx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
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
  await a.goto(`${BASE}#/admin/settings`)
  const card = a.locator('section', { has: a.getByRole('heading', { name: 'How guests RSVP' }) })
  await card.waitFor({ timeout: 20000 })
  await card.getByText(/names? on your list/).waitFor({ timeout: 10000 })
  ok('admin: "How guests RSVP" is the first thing in Website Settings', true)
  ok('admin: open link is blocked while the list has names', await card.getByRole('radio', { name: /Open link/ }).isDisabled())
  shots.push(['open-rsvp-admin-blocked', await card.screenshot()])
  await card.getByRole('button', { name: 'Remove the list and switch' }).click()
  const dlg = a.getByRole('dialog')
  ok('admin: removing needs the word typed', await dlg.getByRole('button', { name: 'Remove and switch' }).isDisabled())
  await dlg.getByLabel(/Type REMOVE/).fill('REMOVE')
  await dlg.getByRole('button', { name: 'Remove and switch' }).click()
  await card.getByText('Share this link with everyone:').waitFor({ timeout: 10000 })
  ok('admin: after clearing, the open link is in use', calls.some((c) => c.fn === 'admin_clear_guest_list') && settings.rsvp_mode === 'open')
  shots.push(['open-rsvp-admin-open', await card.screenshot()])
  ok('no page errors (admin)', aerr.length === 0, aerr.join(' | '))
  await actx.close()
} catch (e) {
  ok('script', false, String(e))
  if (current) shots.push(['open-rsvp-failure', await current.screenshot({ fullPage: true }).catch(() => Buffer.alloc(0))])
} finally {
  await browser.close()
}
for (const [name, png] of shots) writeFileSync(`${OUT}/${name}.png`, png)
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
