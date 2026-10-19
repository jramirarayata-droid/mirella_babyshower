import { supabase } from '../lib/supabase'
import type { Feature, Plan } from '../lib/plans'
import { FriendlyError, logError } from '../utils/errors'

/** Logins made by the owner use a username; Supabase Auth needs an email-shaped name. */
export const USERNAME_DOMAIN = 'accounts.invalid'
export const loginEmail = (usernameOrEmail: string) => {
  const v = usernameOrEmail.trim().toLowerCase()
  return v.includes('@') ? v : `${v}@${USERNAME_DOMAIN}`
}

export interface SpacePlan {
  id: string
  name: string
  guestLimit: number | null
  features: Feature[]
}

export interface SpaceInfo {
  exists: boolean
  id: string | null
  slug: string | null
  title: string
  isDefault: boolean
  open: boolean
  activeUntil: string | null
  plan: SpacePlan | null
  /** Active guests (admins only). */
  guests: number | null
  /** The database has no spaces yet (before migration 046): everything works as before. */
  legacy: boolean
}

const LEGACY: SpaceInfo = {
  exists: true, id: null, slug: null, title: '', isDefault: true, open: true, activeUntil: null, plan: null, guests: null, legacy: true,
}

type Raw = Record<string, unknown> | null
const str = (v: unknown) => (typeof v === 'string' ? v : null)
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : null)

function mapPlan(p: Raw): SpacePlan | null {
  if (!p) return null
  return {
    id: String(p.id ?? ''),
    name: String(p.name ?? ''),
    guestLimit: num(p.guestLimit),
    features: Array.isArray(p.features) ? (p.features as Feature[]) : [],
  }
}

function mapSpace(r: Raw): SpaceInfo {
  if (!r || typeof r !== 'object') return LEGACY
  if (r.exists === false) return { ...LEGACY, exists: false, open: false, legacy: false }
  return {
    exists: true,
    id: str(r.id),
    slug: str(r.slug),
    title: str(r.title) ?? '',
    isDefault: r.isDefault === true,
    open: r.open !== false,
    activeUntil: str(r.activeUntil),
    plan: mapPlan(r.plan as Raw),
    guests: num(r.guests),
    legacy: false,
  }
}

/** The shower this page is for. Falls back to "everything on" if the database isn't updated yet. */
export async function loadSpaceHere(): Promise<SpaceInfo> {
  const { data, error } = await supabase.rpc('space_here' as never)
  if (error) {
    logError('loadSpaceHere', error)
    return LEGACY
  }
  return mapSpace(data as Raw)
}

export interface MySpace {
  id: string
  slug: string
  title: string
  isActive: boolean
  activeUntil: string | null
  open: boolean
  plan: SpacePlan | null
  guests: number
}
export interface MyAccount {
  username: string | null
  displayName: string
  superAdmin: boolean
  spaces: MySpace[]
}

export async function loadMyAccount(): Promise<MyAccount | null> {
  const { data, error } = await supabase.rpc('my_account' as never)
  if (error) {
    logError('loadMyAccount', error)
    return null
  }
  const r = data as Raw
  if (!r) return null
  const spaces = Array.isArray(r.spaces) ? (r.spaces as Raw[]) : []
  void supabase.rpc('touch_last_login' as never)
  return {
    username: str(r.username),
    displayName: str(r.displayName) ?? '',
    superAdmin: r.superAdmin === true,
    spaces: spaces.map((s) => ({
      id: String(s?.id ?? ''),
      slug: String(s?.slug ?? ''),
      title: String(s?.title ?? ''),
      isActive: s?.isActive === true,
      activeUntil: str(s?.activeUntil),
      open: s?.open === true,
      plan: mapPlan((s?.plan as Raw) ?? null),
      guests: num(s?.guests) ?? 0,
    })),
  }
}

export async function loadPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans' as never)
    .select('id,name,tagline,price_php,guest_limit,features,highlight,sort')
    .order('sort' as never)
  if (error) {
    logError('loadPlans', error)
    return []
  }
  return ((data ?? []) as Record<string, unknown>[]).map((p) => ({
    id: String(p.id),
    name: String(p.name),
    tagline: String(p.tagline ?? ''),
    pricePhp: Number(p.price_php ?? 0),
    guestLimit: p.guest_limit == null ? null : Number(p.guest_limit),
    features: (p.features as Feature[]) ?? [],
    highlight: p.highlight === true,
  }))
}

// ----------------------------------------------------------------- owner (super admin)

export interface OwnerSpace {
  id: string
  slug: string
  title: string
  planId: string
  isActive: boolean
  activeUntil: string | null
  isDefault: boolean
  notes: string
  createdAt: string
  open: boolean
  guests: number
  replies: number
  admins: { userId: string; username: string; displayName: string; lastLoginAt: string | null }[]
}
export interface OwnerAccount {
  userId: string
  username: string
  displayName: string
  superAdmin: boolean
  lastLoginAt: string | null
  createdAt: string
  spaces: string[]
}

function ownerError(context: string, error: { message?: string; code?: string } | null): never {
  logError(context, error)
  const m = error?.message ?? ''
  if (error?.code === '23505' || m.includes('duplicate key')) throw new FriendlyError('That web address is already taken. Please pick another.')
  if (error?.code === '23514' || m.includes('check constraint')) {
    throw new FriendlyError('Web addresses use small letters, numbers and dashes (3–40 characters), e.g. baby-cruz.')
  }
  if (m.includes('Co-host')) throw new FriendlyError(m)
  if (error?.code === '42501' || m.includes('Not allowed')) throw new FriendlyError('Only the owner account can do this.')
  throw new FriendlyError('That didn’t save. Please try again.')
}

export async function ownerSpaces(): Promise<OwnerSpace[]> {
  const { data, error } = await supabase.rpc('owner_spaces' as never)
  if (error) ownerError('ownerSpaces', error)
  return (data ?? []) as OwnerSpace[]
}

export async function ownerAccounts(): Promise<OwnerAccount[]> {
  const { data, error } = await supabase.rpc('owner_accounts' as never)
  if (error) ownerError('ownerAccounts', error)
  return (data ?? []) as OwnerAccount[]
}

export interface SpaceInput {
  id: string | null
  slug: string
  title: string
  planId: string
  isActive: boolean
  activeUntil: string | null
  notes: string
}

export async function ownerSaveSpace(s: SpaceInput): Promise<string> {
  const { data, error } = await supabase.rpc('owner_save_space' as never, {
    p_id: s.id,
    p_slug: s.slug.trim().toLowerCase(),
    p_title: s.title.trim(),
    p_plan: s.planId,
    p_active: s.isActive,
    p_until: s.activeUntil || null,
    p_notes: s.notes,
  } as never)
  if (error) ownerError('ownerSaveSpace', error)
  return String(data)
}

export async function ownerSetMember(userId: string, spaceId: string, member: boolean): Promise<void> {
  const { error } = await supabase.rpc('owner_set_member' as never, { p_user: userId, p_space: spaceId, p_member: member } as never)
  if (error) ownerError('ownerSetMember', error)
}

/** Creating logins and setting passwords needs the server (Edge Function "owner-users"). */
async function ownerUsers(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('owner-users', { body })
  if (error) {
    logError('ownerUsers', error)
    let msg = ''
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') msg = String(((await ctx.json()) as { error?: string }).error ?? '')
    } catch {
      /* ignore */
    }
    throw new FriendlyError(msg || 'That didn’t work. Please try again.')
  }
  return (data ?? {}) as Record<string, unknown>
}

export async function ownerCreateLogin(input: { username: string; password: string; displayName: string; spaceId: string | null }): Promise<string> {
  const r = await ownerUsers({ action: 'create', ...input, username: input.username.trim().toLowerCase() })
  return String(r.userId ?? '')
}

export async function ownerSetPassword(userId: string, password: string): Promise<void> {
  await ownerUsers({ action: 'set_password', userId, password })
}

export async function ownerDeleteLogin(userId: string): Promise<void> {
  await ownerUsers({ action: 'delete', userId })
}
