// Owner (super admin) tools that need the server: create a login, set a
// password, delete a login. Only an account marked is_super_admin may call it.
//
// Deploy: Supabase → Edge Functions (name "owner-users"). It uses the
// project's own SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY,
// which Supabase provides to every Edge Function — nothing to paste in.
import { createClient } from 'npm:@supabase/supabase-js@2'

const USERNAME_DOMAIN = 'accounts.invalid' // keep in step with src/services/spaceService.ts
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])$/

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-space',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply({ error: 'Not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Who is calling?
  const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: me } = await caller.auth.getUser()
  if (!me?.user) return reply({ error: 'Please sign in again.' }, 401)

  const admin = createClient(url, service, { auth: { persistSession: false } })
  const { data: acct } = await admin.from('accounts').select('is_super_admin').eq('user_id', me.user.id).maybeSingle()
  if (!acct?.is_super_admin) return reply({ error: 'Only the owner account can do this.' }, 403)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return reply({ error: 'Bad request' }, 400)
  }
  const password = typeof body.password === 'string' ? body.password : ''
  const okPassword = (p: string) => p.length >= 8 && p.length <= 72

  if (body.action === 'create') {
    const username = String(body.username ?? '').trim().toLowerCase()
    const displayName = String(body.displayName ?? '').trim().slice(0, 80)
    const spaceId = typeof body.spaceId === 'string' && body.spaceId ? body.spaceId : null
    if (!USERNAME_RE.test(username)) return reply({ error: 'Usernames use small letters, numbers, dots, dashes or underscores (3–32 characters).' }, 400)
    if (!okPassword(password)) return reply({ error: 'Passwords need at least 8 characters.' }, 400)
    const { data: taken } = await admin.from('accounts').select('user_id').eq('username', username).maybeSingle()
    if (taken) return reply({ error: 'That username is already taken.' }, 409)

    const { data: created, error } = await admin.auth.admin.createUser({
      email: `${username}@${USERNAME_DOMAIN}`,
      password,
      email_confirm: true,
      user_metadata: { username, display_name: displayName },
    })
    if (error || !created.user) return reply({ error: `Could not create the login (${error?.message ?? 'unknown'}).` }, 400)
    const userId = created.user.id

    const { error: e2 } = await admin.from('accounts').insert({ user_id: userId, username, display_name: displayName })
    if (e2) {
      await admin.auth.admin.deleteUser(userId)
      return reply({ error: 'Could not save the account. Nothing was created.' }, 400)
    }
    if (spaceId) {
      const { error: e3 } = await admin.from('admin_users').insert({ space_id: spaceId, user_id: userId, email: created.user.email })
      if (e3) return reply({ userId, warning: 'Login created, but it could not be linked to the shower. Link it from the owner page.' })
    }
    return reply({ userId })
  }

  if (body.action === 'set_password') {
    const userId = String(body.userId ?? '')
    if (!okPassword(password)) return reply({ error: 'Passwords need at least 8 characters.' }, 400)
    const { error } = await admin.auth.admin.updateUserById(userId, { password })
    if (error) return reply({ error: 'Could not change the password.' }, 400)
    return reply({ ok: true })
  }

  if (body.action === 'delete') {
    const userId = String(body.userId ?? '')
    if (userId === me.user.id) return reply({ error: 'You can’t delete your own login.' }, 400)
    const { error } = await admin.auth.admin.deleteUser(userId) // accounts and admin_users rows go with it
    if (error) return reply({ error: 'Could not delete the login.' }, 400)
    return reply({ ok: true })
  }

  return reply({ error: 'Unknown action' }, 400)
})
