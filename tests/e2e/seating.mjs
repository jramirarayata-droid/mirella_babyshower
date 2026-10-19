// Seating plan names: renders Admin → Seating with the real table layout and
// made-up names (same lengths as the real ones), then saves screenshots and
// the downloaded images. Mocked backend — nothing live is touched.
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

const T = [
  ['t1', 'Cherished - VIP', 10, 1100, 250, 220, 50, 8],
  ['t2', 'Faith', 12, 1090, 440, 270, 50, 9],
  ['t3', 'Heart', 12, 1100, 700, 280, 50, 10],
  ['t4', 'Circle', 9, 620, 430, 280, 50, 14],
  ['t5', 'Bloom', 6, 530, 260, 230, 50, 15],
  ['t6', 'Gathered', 9, 620, 580, 300, 60, 16],
  ['t7', 'Joy', 8, 540, 790, 350, 60, 17],
]
const tables = T.map(([id, name, capacity, x, y, width, height, sort_order]) => ({ id, name, shape: 'rect', capacity, seat_sides: 'both', x, y, width, height, rotation: 0, placed: true, sort_order, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' }))
const items = [
  ['custom', 'Picapica', 1090, 50, 220, 60, 0],
  ['buffet', '', 1090, 910, 550, 60, 0],
  ['stage', '', 1450, 570, 420, 90, 90],
  ['photo_booth', '', 300, 480, 220, 60, 90],
  ['custom', 'Counter', 450, 900, 470, 50, 0],
  ['dance_floor', '', 1360, 560, 100, 240, 0],
  ['entrance', '', 850, 100, 160, 50, 0],
].map(([kind, label, x, y, width, height, rotation], i) => ({ id: `i${i}`, kind, label, x, y, width, height, rotation, location: 'auto', created_at: '2026-10-01T00:00:00Z' }))

// Made-up names, the same lengths as the real guest list.
const FIRST = ['Maria', 'Jose', 'Ana', 'Ramon', 'Lourdes', 'Carlo', 'Bea', 'Miguel', 'Teresita', 'Paolo', 'Rosalinda', 'Jun', 'Kristine Joy', 'Mark Anthony', 'Princess Mae', 'John Paul']
const LAST = ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Dela Cruz', 'Villanueva', 'Garcia', 'Mendoza', 'Ramos', 'Aquino', 'Castillo', 'Navarro', 'Fernandez', 'Soriano']
const LENS = { t3: [19, 15, 15, 11, 11, 13, 15, 12, 21, 12, 14, 13], t4: [16, 21, 11, 9, 11, 13, 15, 11, 10], t7: [12, 12, 13, 15, 0, 11, 14, 14], t6: [11, 23, 16, 13, 18, 18, 19, 15, 16], t1: [18, 15, 12, 13, 11, 19, 11, 12, 16, 16], t2: [13, 13, 16, 16, 14, 14, 10, 13, 22, 14, 15, 21], t5: [19, 18, 21, 18, 19, 13] }
let n = 0
const nameOfLen = (len) => {
  let best = 'Guest'
  for (let k = 0; k < 400; k++) {
    const c = `${FIRST[(n + k) % FIRST.length]} ${LAST[(n * 3 + k * 7) % LAST.length]}`
    if (Math.abs(c.length - len) < Math.abs(best.length - len)) best = c
    if (c.length === len) break
  }
  n++
  return best
}
const invitations = []
const seats = []
for (const [tid, lens] of Object.entries(LENS)) {
  lens.forEach((len, i) => {
    if (!len) return
    const id = `inv-${tid}-${i}`
    invitations.push({ id, invitee_name: nameOfLen(len), search_name: '', invitation_code: `C${n}`, table_number: null, max_additional_guests: 0, is_active: true, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', table_id: tid, printed_at: null, position_mode: 'auto', position_label: null, side: i % 2 ? 'bride' : 'groom' })
    seats.push({ id: `s-${tid}-${i}`, table_id: tid, seat_index: i, invitation_id: id, guest_id: null, created_at: '2026-09-01T00:00:00Z' })
  })
}
const settings = { id: 'ws1', couple_names: 'Juan & Maria Santos', baby_name: 'Baby Santos', wedding_date: '2027-03-13', seating_config: { room: { x: 100, y: 100, width: 1400, height: 900 }, canvas: { width: 1600, height: 1100 }, finder: { from: null, mode: 'visible', preassign: false } }, entourage: [], sections: [], motif_colors: [] }
const responses = invitations.map((inv) => ({ id: `r-${inv.id}`, invitation_id: inv.id, attendance_status: 'attending', submitted_at: '2026-09-02T00:00:00Z', updated_at: '2026-09-02T00:00:00Z' }))

async function handle(route) {
  const req = route.request()
  const url = new URL(req.url())
  const p = url.pathname
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
  const accept = req.headers()['accept'] ?? ''
  const rows = (list) => (accept.includes('vnd.pgrst.object') ? (list[0] ? json(list[0]) : json({ message: 'none' }, 406)) : json(list))
  if (p === '/rest/v1/rpc/is_admin') return json(true)
  if (p.startsWith('/rest/v1/rpc/')) return json(null)
  if (p.startsWith('/auth/v1/user')) return json({ id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' })
  const table = p.replace('/rest/v1/', '')
  const map = { seating_tables: tables, seating_items: items, seat_assignments: seats, invitations, wedding_settings: [settings], rsvp_responses: responses }
  // Seat assignments are kept for real here, so undo / redo can be checked against the data.
  if (table === 'seat_assignments' && req.method() === 'DELETE') {
    const id = url.searchParams.get('id')?.replace(/^eq\./, '')
    const inv = url.searchParams.get('invitation_id')?.replace(/^eq\./, '')
    for (let k = seats.length - 1; k >= 0; k--) if ((id && seats[k].id === id) || (inv && seats[k].invitation_id === inv)) seats.splice(k, 1)
    seatOps.push(`delete ${id ?? inv}`)
    return json(null, 204)
  }
  if (table === 'seat_assignments' && req.method() === 'POST') {
    const body = JSON.parse(req.postData() || '{}')
    const row = { id: `new-${++seatSeq}`, created_at: '2026-10-12T00:00:00Z', guest_id: null, ...(Array.isArray(body) ? body[0] : body) }
    seats.push(row)
    seatOps.push(`insert ${row.invitation_id}@${row.table_id}:${row.seat_index}`)
    return accept.includes('vnd.pgrst.object') ? json(row, 201) : json([row], 201)
  }
  if (req.method() !== 'GET') return json(null, 204)
  return rows(map[table] ?? [])
}
let seatSeq = 0
const seatOps = []

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true })
  await ctx.route(`${API}/**`, handle)
  await ctx.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 86400
    const payload = btoa(JSON.stringify({ sub: 'u1', role: 'authenticated', exp })).replace(/=+$/, '')
    localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: `e30.${payload}.sig`, refresh_token: 'r', expires_at: exp, expires_in: 86400, token_type: 'bearer', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' } }))
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}#/admin/seating`)
  await page.getByRole('heading', { name: 'Seating' }).first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Show names' }).click()
  await page.waitForTimeout(800)
  const labels = await page.locator('svg text tspan').count()
  ok('names drawn', labels >= 60, `${labels} name lines`)
  // Overlap check between name boxes.
  const overlaps = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('svg g[aria-hidden="true"] > text')].map((t) => t.getBBox())
    let c = 0
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        if (a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1) c++
      }
    return { c, n: boxes.length }
  })
  ok('names do not overlap (first names)', overlaps.c === 0, `${overlaps.c} overlaps among ${overlaps.n}`)
  const plan = page.getByRole('region', { name: 'Floor plan' })
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await page.waitForTimeout(500)
  writeFileSync(`${OUT}/seating-screen.png`, await plan.screenshot())

  for (const [label, file] of [
    ['With first names', 'seating-first-names.png'],
    ['With full names', 'seating-full-names.png'],
  ]) {
    await page.getByRole('button', { name: 'Download image' }).click()
    await page.getByLabel(new RegExp(label)).check()
    const list = page.getByLabel(/Add a list of guests by table/)
    if (await list.isChecked()) await list.uncheck()
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: /Download PNG/ }).click()])
    await dl.saveAs(`${OUT}/${file}`)
    ok(`downloaded ${label.toLowerCase()}`, true)
    await page.waitForTimeout(800)
  }
  // ---------------------------------------------------------------- undo / redo of seat changes (real data)
  const seatOf = (inv) => seats.find((x) => x.invitation_id === inv)
  const who = invitations.find((i) => i.id === 'inv-t5-0').invitee_name
  await page.locator('[data-chair="t5:0"]').dispatchEvent('click')
  await page.getByRole('button', { name: 'Empty this chair' }).click()
  await page.waitForTimeout(900)
  ok('emptying a chair removes the seat', !seatOf('inv-t5-0'))
  const undoToast = page.getByRole('status').filter({ hasText: who })
  ok('the message says what can be undone', (await undoToast.count()) === 1, await undoToast.first().innerText().catch(() => ''))
  writeFileSync(`${OUT}/seating-undo-toast.png`, await page.screenshot({ clip: { x: 900, y: 0, width: 600, height: 220 } }))
  await undoToast.getByRole('button', { name: 'Undo' }).click()
  await page.waitForTimeout(1200)
  ok('Undo puts the guest back in the same chair', seatOf('inv-t5-0')?.table_id === 't5' && seatOf('inv-t5-0')?.seat_index === 0, JSON.stringify(seatOf('inv-t5-0') ?? null))
  await page.getByRole('button', { name: 'Redo (Ctrl+Shift+Z)' }).click()
  await page.waitForTimeout(1200)
  ok('Redo empties it again', !seatOf('inv-t5-0'))
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(1200)
  ok('Ctrl+Z undoes too', seatOf('inv-t5-0')?.seat_index === 0)
  // Someone else changed that seat meanwhile: undo refuses instead of overwriting.
  await page.locator('[data-chair="t5:1"]').dispatchEvent('click')
  await page.getByRole('button', { name: 'Empty this chair' }).click()
  await page.waitForTimeout(900)
  seats.push({ id: 'other-1', table_id: 't5', seat_index: 1, invitation_id: 'inv-t4-0', guest_id: null, created_at: '2026-10-12T00:00:00Z' })
  for (let k = seats.length - 1; k >= 0; k--) if (seats[k].invitation_id === 'inv-t4-0' && seats[k].id !== 'other-1') seats.splice(k, 1)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(1200)
  ok('undo refuses when the seat was changed since', !seatOf('inv-t5-1') && seatOf('inv-t4-0')?.id === 'other-1' && (await page.getByRole('alert').filter({ hasText: /changed since/ }).count()) === 1)

  // ---------------------------------------------------------------- sidebar: open by default, icons only, opens on hover
  const side = page.getByRole('complementary', { name: 'Sidebar' })
  const sideW = async () => Math.round((await side.boundingBox()).width)
  ok('sidebar open by default', (await sideW()) >= 250, String(await sideW()))
  await page.getByRole('button', { name: 'Collapse the sidebar' }).click()
  await page.waitForTimeout(400)
  await page.mouse.move(900, 500)
  await page.waitForTimeout(500)
  ok('collapses to icons', (await sideW()) <= 80 && (await page.getByRole('link', { name: 'Invitations' }).getAttribute('title')) === 'Invitations', String(await sideW()))
  const mainLeft = await page.locator('main').evaluate((m) => parseFloat(getComputedStyle(m).marginLeft))
  ok('the page gets the room', mainLeft <= 80, String(mainLeft))
  writeFileSync(`${OUT}/sidebar-collapsed.png`, await page.screenshot())
  await side.hover()
  await page.waitForTimeout(700)
  ok('opens on hover, over the page', (await sideW()) >= 250 && (await page.locator('main').evaluate((m) => parseFloat(getComputedStyle(m).marginLeft))) <= 80)
  writeFileSync(`${OUT}/sidebar-hover.png`, await page.screenshot())
  await page.mouse.move(1200, 600)
  await page.waitForTimeout(800)
  ok('closes again when the mouse leaves', (await sideW()) <= 80)
  await page.reload()
  await page.getByRole('heading', { name: 'Seating' }).first().waitFor({ timeout: 20000 })
  ok('remembered after reload', (await sideW()) <= 80)
  await page.getByRole('button', { name: 'Keep the sidebar open' }).click()
  await page.waitForTimeout(400)
  ok('opens again', (await sideW()) >= 250)

  // ---------------------------------------------------------------- tables: the sideways scrollbar is always on screen
  await page.goto(`${BASE}#/admin/invitations`)
  const scroller = page.locator('[data-table-scroll]')
  await scroller.waitFor({ timeout: 20000 })
  await page.waitForTimeout(800)
  const box = await scroller.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { bottom: Math.round(r.bottom), vh: innerHeight, scrolls: el.scrollHeight > el.clientHeight + 2 }
  })
  ok('table fits the screen (its scrollbar is visible)', box.bottom <= box.vh && box.scrolls, JSON.stringify(box))
  await scroller.evaluate((el) => (el.scrollTop = 600))
  await page.waitForTimeout(300)
  const head = await scroller.evaluate((el) => Math.round(el.querySelector('thead').getBoundingClientRect().top - el.getBoundingClientRect().top))
  ok('column headings stay at the top', Math.abs(head) <= 2, String(head))
  writeFileSync(`${OUT}/table-scroll.png`, await page.screenshot())
  ok('no page errors', errors.length === 0, errors.join(' | '))
} catch (e) {
  ok('script', false, String(e))
} finally {
  await browser.close()
}
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
