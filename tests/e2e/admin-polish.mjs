// Admin polish: sidebar groups, unsaved-changes guard, quick search (Ctrl+K), red delete buttons, visible keyboard focus.
// Harness copied from printables.mjs.
// Printables: "addressed as" per invitation (suggestions only, saved one by one),
// the entourage card (separate card, on the back, and its own tab), and the
// online invitation showing the "addressed as". Mocked backend — nothing live is touched.
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
const inv = (id, name, code, extra = {}) => ({ id, invitee_name: name, search_name: name.toLowerCase(), invitation_code: code, table_number: null, max_additional_guests: 0, is_active: true, created_at: T, updated_at: T, table_id: null, printed_at: null, position_mode: 'auto', position_label: null, side: 'groom', addressed_as: null, ...extra })
const invitations = [
  inv('inv-1', 'Juan dela Cruz', 'JUAN1'),
  inv('inv-2', 'Elvira Arayata', 'ELVI2'),
  inv('inv-3', 'Ramon Garcia Jr.', 'RAMO3'),
  inv('inv-4', 'Joey Montes', 'JOEY4', { addressed_as: 'Mr. Joey Montes & Mrs. Vivian Montes', position_mode: 'custom', position_label: 'Principal Sponsor' }),
]
const guest = (id, invitationId, name) => ({ id, invitation_id: invitationId, rsvp_response_id: null, guest_name: name, status: 'approved', added_by: 'admin', created_at: T, updated_at: T })
const guests = [guest('g1', 'inv-1', 'Maria dela Cruz'), guest('g2', 'inv-3', 'Tess Garcia'), guest('g3', 'inv-3', 'Paolo Garcia'), guest('g4', 'inv-3', 'Bea Garcia')]
const m = (name, role = '') => ({ id: Math.random().toString(36).slice(2), name, role })
const entourage = [
  { id: 'e1', title: 'Parents of the Groom', layout: 'pairs', members: [m('Rogelio Ramirez'), m('Carmela Ramirez')] },
  { id: 'e2', title: 'Father of the Bride', layout: 'list', members: [m('Ernesto Villanueva')] },
  { id: 'e3', title: 'Principal Sponsors', layout: 'pairs', members: [m('Hon. Antonio Reyes'), m('Dra. Lourdes Reyes'), m('Engr. Manuel Santos'), m('Teresita Santos'), m('Ricardo Bautista'), m('Rosalinda Bautista'), m('Atty. Jose Mendoza'), m('Maria Clara Mendoza'), m('Fernando Castillo'), m('Gloria Castillo')] },
  { id: 'e4', title: 'Best Man', layout: 'list', members: [m('Mark Anthony Soriano')] },
  { id: 'e5', title: 'Maid of Honor', layout: 'list', members: [m('Kristine Joy Navarro')] },
  { id: 'e6', title: 'Candle', layout: 'pairs', members: [m('Paolo Aquino'), m('Bea Aquino')] },
  { id: 'e7', title: 'Veil', layout: 'pairs', members: [m('Carlo Ramos'), m('Princess Mae Ramos')] },
  { id: 'e8', title: 'Cord', layout: 'pairs', members: [m('Miguel Fernandez'), m('Ana Fernandez')] },
  { id: 'e9', title: 'Bearers', layout: 'list', members: [m('Joaquin Reyes', 'Ring'), m('Elijah Santos', 'Coin'), m('Santi Cruz', 'Bible')] },
  { id: 'e10', title: 'Flower Grandma', layout: 'list', members: [m('Lola Nena Villanueva')] },
]
const settings = { id: 'ws1', couple_names: 'Juan & Maria Santos', baby_name: 'Baby Santos', wedding_date: '2027-03-13', church_name: 'Sample Garden Venue', ceremony_time: '2:00 PM', reception_name: 'The Glass Garden', reception_time: '5:00 PM', rsvp_open: true, entourage, entourage_title: 'The Entourage', outfit_layout: 'pairs', outfit_section_visible: true, outfit_title: 'Attire Inspiration', sections: [], additional_info: [{ id: 'g1', title: 'Dress code', body: 'Formal attire, please.', icon: 'info', visible: true }], motif_colors: [], seating_config: { finder: { from: null, mode: 'visible', preassign: false } } }
const outfit = (id, gender, file, caption, label, sort_order) => ({ id, gender, image_url: `attire/${file}.jpg`, caption, label, sort_order, is_visible: true, created_at: T, updated_at: T })
const outfits = [
  outfit('o1', 'male', 'sponsors-him', 'Embroidered barong & taupe trousers', 'Principal Sponsors', 1),
  outfit('o2', 'male', 'family-him', 'Ivory barong & brown trousers', 'Parents & Relatives', 2),
  outfit('o3', 'male', 'guests-him', 'Polo shirt & beige trousers', 'Guests', 3),
  outfit('o4', 'female', 'sponsors-her', 'One-shoulder gown in taupe', 'Principal Sponsors', 1),
  outfit('o5', 'female', 'family-her', 'Modern Filipiniana in mocha', 'Parents & Relatives', 2),
  outfit('o6', 'female', 'guests-her', 'Puff-sleeve midi dress in cream', 'Guests', 3),
  outfit('o7', 'male', 'look4-him', 'Cream turtleneck with long sleeves', null, 4),
  outfit('o8', 'female', 'look4-her', 'Beige dress with regular sleeves', null, 4),
]
const table = (id, name, sort_order) => ({ id, name, shape: 'round', capacity: 10, seat_sides: 'all', x: 0, y: 0, width: 170, height: 170, rotation: 0, placed: true, sort_order, created_at: T, updated_at: T })
const seatingTables = [table('t1', 'Sponsors', 1), table('t2', 'Family', 2), table('t3', 'Table 5', 3)]
const seats = [{ id: 's1', table_id: 't1', seat_index: 0, invitation_id: 'inv-1', guest_id: null, created_at: T }]
const patches = []
const prefWrites = []

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
    const a = JSON.parse(req.postData() || '{}')
    if (fn === 'is_admin') return json(true)
    if (fn === 'public_display_prefs') return json({ card: {}, website: {}, sharePreviewUrl: null, raffleVisible: false, monogram: null })
    if (fn === 'open_invitation') {
      const i = invitations.find((x) => x.invitation_code === a.invite_code)
      if (!i) return json([])
      return json([{ invitee_name: i.invitee_name, included_guests: guests.filter((g) => g.invitation_id === i.id).map((g) => g.guest_name), attendance_status: null, position_mode: 'auto', position_label: null, position_member_id: null, addressed_as: i.addressed_as }])
    }
    return json(null)
  }
  if (p.startsWith('/auth/v1/user')) return json({ id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' })
  const table = p.replace('/rest/v1/', '')
  if (table === 'invitations' && req.method() === 'PATCH') {
    const id = (url.searchParams.get('id') ?? '').replace(/^eq\./, '')
    const body = JSON.parse(req.postData() || '{}')
    patches.push({ id, body })
    const row = invitations.find((x) => x.id === id)
    if (row) Object.assign(row, body)
    return json(null, 204)
  }
  if (table === 'outfit_images' && req.method() === 'PATCH') {
    const id = (url.searchParams.get('id') ?? '').replace(/^eq\./, '')
    const body = JSON.parse(req.postData() || '{}')
    patches.push({ table, id, body })
    Object.assign(outfits.find((o) => o.id === id) ?? {}, body)
    return json(null, 204)
  }
  if (table === 'admin_preferences' && req.method() === 'POST') prefWrites.push(JSON.parse(req.postData() || 'null'))
  if (req.method() !== 'GET') return json(null, 204)
  const map = { invitations, additional_guests: guests, wedding_settings: [settings], rsvp_responses: [], outfit_images: outfits, seating_tables: seatingTables, seat_assignments: seats }
  return rows(map[table] ?? [])
}


const browser = await chromium.launch()
const shots = []
let page = null
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.route(`${API}/**`, handle)
  await ctx.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 86400
    const payload = btoa(JSON.stringify({ sub: 'u1', role: 'authenticated', exp })).replace(/=+$/, '')
    localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: `e30.${payload}.sig`, refresh_token: 'r', expires_at: exp, expires_in: 86400, token_type: 'bearer', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' } }))
  })
  page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  // ---------------------------------------------------------------- sidebar groups
  await page.goto(`${BASE}#/admin`)
  await page.getByRole('navigation', { name: 'Admin' }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(800)
  const groups = await page.getByRole('navigation', { name: 'Admin' }).evaluate((nav) =>
    [...nav.children].map((g) => [g.querySelector('p')?.textContent ?? '', [...g.querySelectorAll('a')].map((a) => a.textContent.trim())]),
  )
  const invite = groups.find(([t]) => t === 'Invite & print')
  ok('“Invite & print” groups Invitations, Printables and Share & QR', JSON.stringify(invite?.[1]) === JSON.stringify(['Invitations', 'Printables', 'Share & QR']), JSON.stringify(groups))
  ok('“Additional Guests” is now “Extra guests”', groups.some(([, items]) => items.includes('Extra guests')) && !groups.some(([, items]) => items.includes('Additional Guests')))
  shots.push(['polish-sidebar', await page.locator('aside').first().screenshot()])

  // ---------------------------------------------------------------- unsaved changes: asks before leaving
  await page.getByRole('link', { name: 'Website Settings' }).click()
  await page.waitForTimeout(1500)
  const status = page.locator('[data-save-status]').first()
  ok('“All changes saved” before editing', (await status.getAttribute('data-save-status')) === 'saved', await status.innerText())
  const field = page.locator('main input[type="text"], main input:not([type])').first()
  await field.fill(`${await field.inputValue()} x`)
  await page.waitForTimeout(300)
  ok('“Unsaved changes” after editing', (await status.getAttribute('data-save-status')) === 'unsaved')
  await page.getByRole('link', { name: 'Invitations' }).click()
  const leave = page.getByRole('dialog', { name: 'Leave without saving?' })
  await leave.waitFor({ timeout: 3000 })
  ok('leaving asks first, naming what’s unsaved', (await leave.innerText()).includes('Website Settings'))
  shots.push(['polish-leave-dialog', await leave.screenshot()])
  await leave.getByRole('button', { name: 'Stay on this page' }).click()
  await page.waitForTimeout(400)
  ok('“Stay” keeps you on the page with your edit', page.url().includes('#/admin/settings') && (await field.inputValue()).endsWith(' x'))
  await page.getByRole('link', { name: 'Invitations' }).click()
  await leave.getByRole('button', { name: 'Leave without saving' }).click()
  await page.waitForTimeout(1200)
  ok('“Leave without saving” goes on', page.url().includes('#/admin/invitations'))
  await page.getByRole('link', { name: 'Seating' }).click()
  await page.waitForTimeout(800)
  ok('no question when nothing is unsaved', page.url().includes('#/admin/seating') && (await leave.count()) === 0)

  // ---------------------------------------------------------------- quick search
  await page.keyboard.press('Control+k')
  const qs = page.getByRole('dialog', { name: 'Quick search' })
  await qs.waitFor({ timeout: 3000 })
  ok('Ctrl+K opens quick search', true)
  await qs.getByRole('combobox').fill('maria')
  await page.waitForTimeout(300)
  const firstHit = await qs.getByRole('option').first().innerText()
  ok('finds an included guest, and says whose invitation', /Maria dela Cruz/.test(firstHit) && /Included in Juan dela Cruz’s invitation/.test(firstHit), firstHit)
  shots.push(['polish-quick-search', await qs.screenshot()])
  await qs.getByRole('combobox').press('Enter')
  await page.waitForTimeout(1500)
  ok('Enter opens Invitations, already searched', page.url().includes('#/admin/invitations') && (await page.getByLabel('Search by invitee name').inputValue()) === 'Juan dela Cruz')
  await page.getByRole('button', { name: 'Quick search (Ctrl+K)' }).click()
  await qs.getByRole('combobox').fill('seat')
  await page.waitForTimeout(300)
  ok('finds pages too', (await qs.getByRole('option', { name: /Seating/ }).count()) === 1)
  await qs.getByRole('combobox').press('Escape')

  // ---------------------------------------------------------------- delete buttons look like delete buttons
  const del = page.getByRole('button', { name: 'Delete Juan dela Cruz' })
  const delColour = await del.evaluate((el) => getComputedStyle(el).color)
  ok('delete is red', delColour === 'rgb(162, 87, 79)', delColour)

  // ---------------------------------------------------------------- keyboard: every focused control shows an outline
  const unseen = []
  for (const path of ['', 'invitations', 'printables', 'settings']) {
    await page.goto(`${BASE}#/admin/${path}`)
    await page.waitForTimeout(1800)
    await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {})
    for (let i = 0; i < 45; i++) {
      await page.keyboard.press('Tab')
      const f = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return null
        // The outline may be drawn on the control or on the label around it (radio cards).
        const shown = (x) => {
          if (!x) return false
          const cs = getComputedStyle(x)
          return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none')
        }
        const ring = shown(el) || shown(el.closest('label')) || el.matches(':focus-within') && shown(el)
        const shadow = false
        const r = el.getBoundingClientRect()
        return { ok: ring || shadow || r.width === 0, what: `${el.tagName.toLowerCase()}[${el.getAttribute('type') ?? ''}] “${(el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.id || '').trim().slice(0, 30)}” .${(el.className || '').toString().slice(0, 60)} in ${el.closest('section,fieldset,label')?.getAttribute('aria-label') ?? el.closest('section,fieldset,label')?.textContent?.trim().slice(0, 40) ?? ''}` }
      })
      if (f && !f.ok) unseen.push(`${path || 'dashboard'}: ${f.what}`)
    }
  }
  ok('every control shows a focus outline when reached with Tab', unseen.length === 0, unseen.slice(0, 8).join(' | '))

  ok('no page errors', errors.length === 0, errors.join(' | '))
} catch (e) {
  ok('test run', false, String(e).slice(0, 400))
  if (page) shots.push(['polish-failure', await page.screenshot().catch(() => Buffer.from(''))])
} finally {
  for (const [n, b] of shots) writeFileSync(`${OUT}/${n}.png`, b)
  await browser.close()
}
const passed = results.filter((r) => r.pass).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed === results.length ? 0 : 1)
