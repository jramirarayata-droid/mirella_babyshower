import { supabase } from '../lib/supabase'
import { FriendlyError, logError } from '../utils/errors'

/*
 * Host mode: the 4-digit host code (Admin → Raffle → Host access) unlocks the
 * raffle, Bingo and presenting photos & videos on the big screen. A signed-in
 * admin is always a host. The host's session is kept on this device for a day.
 */

const KEY = 'wedding-raffle-host'

export function savedHostToken(): string | null {
  try {
    return localStorage.getItem(KEY) || sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function saveHostToken(token: string | null) {
  try {
    if (token) localStorage.setItem(KEY, token)
    else localStorage.removeItem(KEY)
    sessionStorage.removeItem(KEY)
  } catch {
    /* private mode: just this visit */
  }
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** Is this device a host right now, and is a host code set at all? */
export async function checkHost(token: string | null): Promise<{ host: boolean; codeOn: boolean }> {
  const { data, error } = await supabase.rpc('host_check', { p_token: token ?? '' })
  if (!error) {
    const o = obj(data)
    return { host: o.host === true, codeOn: o.codeOn === true }
  }
  // Before migration 031: the raffle's own check.
  const old = await supabase.rpc('raffle_host_state', { p_token: token ?? '' })
  if (old.error) {
    logError('checkHost', error)
    return { host: false, codeOn: true }
  }
  return { host: obj(old.data).host === true, codeOn: true }
}

export type HostLogin = { ok: true; token: string } | { ok: false; reason: 'wrong' | 'locked' | 'off' | 'hidden'; left?: number; minutes?: number }

export async function hostLogin(pin: string): Promise<HostLogin> {
  let res = await supabase.rpc('host_code_login', { p_pin: pin })
  if (res.error) res = await supabase.rpc('raffle_host_code_login', { p_pin: pin })
  if (res.error) {
    logError('hostLogin', res.error)
    throw new FriendlyError('The code couldn’t be checked. Please try again.')
  }
  const o = obj(res.data)
  if (o.ok === true && typeof o.token === 'string') return { ok: true, token: o.token }
  const reason = o.reason === 'locked' || o.reason === 'off' || o.reason === 'hidden' ? o.reason : 'wrong'
  return { ok: false, reason, left: typeof o.left === 'number' ? o.left : undefined, minutes: typeof o.minutes === 'number' ? o.minutes : undefined }
}

export function hostLoginMessage(r: Extract<HostLogin, { ok: false }>): string {
  if (r.reason === 'locked') return `Too many tries. Please wait about ${r.minutes ?? 15} minutes.`
  if (r.reason === 'off') return 'Host mode is turned off. A host code can be set in Admin → Raffle.'
  if (r.reason === 'hidden') return 'Host mode isn’t available right now.'
  return `That code isn’t right.${r.left !== undefined && r.left <= 5 ? ` ${r.left} ${r.left === 1 ? 'try' : 'tries'} left.` : ''}`
}
