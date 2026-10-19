// Invitations: include one invitation in another (Arielito joins Violeta's),
// undo from the toast, and "Own invitation" from the edit form.
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

const T = '2026-09-01T00:00:00Z'
const inv = (id, name, code, extra = {}) => ({ id, invitee_name: name, search_name: name.toLowerCase(), invitation_code: code, table_number: null, max_additional_guests: 0, is_active: true, created_at: T, updated_at: T, table_id: 't1', printed_at: null, position_mode: 'auto', position_label: null, side: 'bride', addressed_as: null, ...extra })
let invitations = [
  inv('inv-a', 'Arielito Pugay', 'ARIEL1', { max_additional_guests: 2, position_mode: 'custom', position_label: 'Father of the Bride' }),
  inv('inv-v', 'Violeta Pugay', 'VIOLE1', { max_additional_guests: 1 }),
  inv('inv-c', 'Carmina Pugay', 'CARMI1'),
  inv('inv-g', 'Gerry Santos', 'GERRY1', { side: 'groom', table_id: null }),
]
let guests = [{ id: 'g-vish', invitation_id: 'inv-c', rsvp_response_id: null, guest_name: 'Vishal Arya', status: 'approved', added_by: 'admin', created_at: T, updated_at: T, merged_from: null }]
let seats = [
  { table_id: 't1', invitation_id: 'inv-a', guest_id: null },
  { table_id: 't1', invitation_id: 'inv-v', guest_id: null },
]
let links = [{ member_id: 'p3', invitation_id: 'inv-a', guest_id: null, created_at: T }]
const opens = [{ invitation_id: 'inv-a', first_opened_at: T, last_opened_at: T, open_count: 3 }]
const entourage = [{ id: 'e1', title: 'Father of the Bride', layout: 'list', members: [{ id: 'p3', name: 'Arielito Pugay', role: '' }] }]
const settings = { id: 'ws1', couple_names: 'Juan & Maria Santos', baby_name: 'Baby Santos', wedding_date: '2027-03-13', rsvp_open: true, entourage, sections: [], additional_info: [], motif_colors: [] }
const tables = [{ id: 't1', name: 'Family', shape: 'round', capacity: 12, seat_sides: 'all', x: 0, y: 0, width: 170, height: 170, rotation: 0, placed: true, sort_order: 1, created_at: T, updated_at: T }]
const calls = []
let failNext = null

// What the database function does, in miniature.
function include(from, into) {
  const a = invitations.find((i) => i.id === from)
  const gid = `g-${from}`
  guests.push({ id: gid, invitation_id: into, rsvp_response_id: null, guest_name: a.invitee_name, status: 'approved', added_by: 'admin', created_at: '2026-09-02T00:00:00Z', updated_at: T, merged_from: { invitee_name: a.invitee_name, invitation_code: a.invitation_code, position_label: a.position_label, side: a.side } })
  guests = guests.map((g) => (g.invitation_id === from ? { ...g, invitation_id: into } : g))
  seats = seats.map((s) => (s.invitation_id === from ? { ...s, invitation_id: into, guest_id: s.guest_id ?? gid } : s))
  links = links.map((l) => (l.invitation_id === from ? { ...l, invitation_id: into, guest_id: l.guest_id ?? gid } : l))
  invitations = invitations.filter((i) => i.id !== from)
  return gid
}
function separate(gid) {
  const g = guests.find((x) => x.id === gid)
  const s = g.merged_from ?? {}
  const id = `inv-back-${gid}`
  invitations.push(inv(id, g.guest_name, s.invitation_code ?? 'NEW123', { position_mode: s.position_label ? 'custom' : 'auto', position_label: s.position_label ?? null, max_additional_guests: 2 }))
  seats = seats.map((x) => (x.guest_id === gid ? { ...x, invitation_id: id, guest_id: null } : x))
  links = links.map((x) => (x.guest_id === gid ? { ...x, invitation_id: id, guest_id: null } : x))
  guests = guests.filter((x) => x.id !== gid)
  return id
}

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
    if (fn === 'admin_include_invitation' || fn === 'admin_separate_guest') {
      calls.push({ fn, a })
      if (failNext) {
        const f = failNext
        failNext = null
        return json(f, 404)
      }
      return json(fn === 'admin_include_invitation' ? include(a.p_from, a.p_into) : separate(a.p_guest))
    }
    return json(null)
  }
  if (p.startsWith('/auth/v1/user')) return json({ id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' })
  const table = p.replace('/rest/v1/', '')
  if (req.method() !== 'GET') return json(null, 204)
  const map = { invitations, additional_guests: guests, wedding_settings: [settings], rsvp_responses: [], seating_tables: tables, seat_assignments: seats, entourage_links: links, invitation_opens: opens }
  return rows(map[table] ?? [])
}

const browser = await chromium.launch()
const shots = []
let page = null
try {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  await ctx.route(`${API}/**`, handle)
  await ctx.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 86400
    const payload = btoa(JSON.stringify({ sub: 'u1', role: 'authenticated', exp })).replace(/=+$/, '')
    localStorage.setItem('sb-mock-auth-token', JSON.stringify({ access_token: `e30.${payload}.sig`, refresh_token: 'r', expires_at: exp, expires_in: 86400, token_type: 'bearer', user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'admin@test' } }))
  })
  page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}#/admin/invitations`)
  const table = page.getByRole('table')
  await table.getByText('Arielito Pugay', { exact: true }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  const rowOf = (name) => table.getByRole('row').filter({ has: page.getByText(name, { exact: true }) }).first()

  // ------------------------------------------------------------------ include Arielito in Violeta's invitation
  await page.getByRole('button', { name: 'Include Arielito Pugay in another invitation' }).click()
  const dlg = page.getByRole('dialog', { name: 'Include Arielito Pugay in another invitation' })
  await dlg.waitFor()
  const confirm = dlg.getByRole('button', { name: /Pick an invitation|Include in/ })
  ok('confirm waits for a choice', await confirm.isDisabled())
  const radios = dlg.getByRole('radiogroup', { name: 'Invitation to include them in' }).getByRole('radio')
  const listed = await radios.allInnerTexts()
  ok('himself is not offered', !listed.some((t) => t.includes('Arielito')), listed.join(' | '))
  ok('same side listed first', listed[listed.length - 1].includes('Gerry Santos'), listed.join(' | '))
  await dlg.getByRole('searchbox', { name: 'Find the invitation to include them in' }).fill('viol')
  ok('search narrows the list', (await radios.count()) === 1)
  await dlg.getByRole('searchbox').fill('vishal')
  ok('search finds by included guest too', (await radios.count()) === 1 && (await radios.first().innerText()).includes('Carmina Pugay'))
  await dlg.getByRole('searchbox').fill('viol')
  await dlg.getByRole('radio', { name: /Violeta Pugay/ }).click()
  const what = dlg.getByRole('region', { name: 'What happens' })
  const text = await what.innerText()
  ok('explains the move', text.includes('Arielito Pugay joins Violeta Pugay’s invitation as an included guest'), text)
  ok('keeps the chair', text.includes('Keeps their chair at Family'))
  ok('no entourage wording', !/entourage/i.test(text), text)
  ok('old link still works', text.includes('it now opens Violeta Pugay’s invitation (opened 3 times so far)'))
  ok('how to undo later', text.includes('“Own invitation” next to Arielito Pugay'))
  shots.push(['invitations-include-dialog', await dlg.screenshot()])
  await dlg.getByRole('button', { name: 'Include in Violeta Pugay’s invitation' }).click()
  await page.getByText('Arielito Pugay is now included in Violeta Pugay’s invitation.').waitFor({ timeout: 5000 })
  ok('asks the database once, with the right two', calls.length === 1 && calls[0].a.p_from === 'inv-a' && calls[0].a.p_into === 'inv-v', JSON.stringify(calls))
  await page.waitForTimeout(500)
  ok('Arielito’s own row is gone', (await page.getByRole('button', { name: 'Edit Arielito Pugay' }).count()) === 0)
  ok('listed under Violeta', (await rowOf('Violeta Pugay').innerText()).includes('Arielito Pugay'))
  shots.push(['invitations-after-include', await page.screenshot()])

  // ------------------------------------------------------------------ undo from the toast
  await page.getByRole('button', { name: 'Undo' }).click()
  await page.getByText('Arielito Pugay has their own invitation again.').last().waitFor({ timeout: 5000 })
  ok('undo separates the same guest', calls[1]?.fn === 'admin_separate_guest' && calls[1].a.p_guest === 'g-inv-a', JSON.stringify(calls[1]))
  await page.waitForTimeout(500)
  ok('his row is back, with his old link', (await page.getByRole('button', { name: 'Edit Arielito Pugay' }).count()) === 1 && invitations.some((i) => i.invitee_name === 'Arielito Pugay' && i.invitation_code === 'ARIEL1'))

  // ------------------------------------------------------------------ include again, then "Own invitation" from the edit form
  const arielId = invitations.find((i) => i.invitee_name === 'Arielito Pugay').id
  await page.getByRole('button', { name: 'Include Arielito Pugay in another invitation' }).click()
  await dlg.getByRole('radio', { name: /Violeta Pugay/ }).click()
  await dlg.getByRole('button', { name: 'Include in Violeta Pugay’s invitation' }).click()
  await page.waitForTimeout(800)
  ok('second include uses his current invitation', calls[2]?.a.p_from === arielId)
  await page.getByRole('button', { name: 'Edit Violeta Pugay' }).click()
  const form = page.getByRole('dialog', { name: 'Edit Invitation' })
  await form.waitFor()
  ok('form says he had his own invitation', (await form.innerText()).includes('Had their own invitation (Father of the Bride).'))
  shots.push(['invitations-edit-own', await form.screenshot()])
  await form.getByRole('button', { name: 'Give Arielito Pugay their own invitation' }).click()
  const sep = page.getByRole('dialog', { name: 'Give them their own invitation?' })
  await sep.waitFor()
  ok('edit form steps aside', await page.getByRole('dialog', { name: 'Edit Invitation' }).waitFor({ state: 'detached', timeout: 3000 }).then(() => true, () => false))
  ok('says the old link comes back', (await sep.innerText()).includes('Their old link and its details'))
  await sep.getByRole('button', { name: 'Own invitation' }).click()
  await page.getByText('Arielito Pugay has their own invitation again.').last().waitFor({ timeout: 5000 })
  await page.waitForTimeout(500)
  ok('separated', calls[3]?.fn === 'admin_separate_guest' && (await page.getByRole('button', { name: 'Edit Arielito Pugay' }).count()) === 1)

  // ------------------------------------------------------------------ before the database update is run
  failNext = { code: 'PGRST202', message: 'Could not find the function public.admin_include_invitation' }
  await page.getByRole('button', { name: 'Include Carmina Pugay in another invitation' }).click()
  const dlg2 = page.getByRole('dialog', { name: 'Include Carmina Pugay in another invitation' })
  await dlg2.getByRole('radio', { name: /Violeta Pugay/ }).click()
  await dlg2.getByRole('button', { name: 'Include in Violeta Pugay’s invitation' }).click()
  await page.getByText('Combining invitations needs a quick database update first (migration 039).').waitFor({ timeout: 5000 })
  ok('friendly message before migration 039', true)
  ok('dialog stays open to try again', (await dlg2.count()) === 1)

  ok('no page errors', errors.length === 0, errors.join(' | '))
} catch (e) {
  ok('test run', false, String(e).slice(0, 400))
  if (page) shots.push(['invitations-failure', await page.screenshot().catch(() => Buffer.from(''))])
} finally {
  for (const [n, b] of shots) writeFileSync(`${OUT}/${n}.png`, b)
  await browser.close()
}
const passed = results.filter((r) => r.pass).length
console.log(`\n${passed}/${results.length} passed`)
process.exit(passed === results.length ? 0 : 1)
