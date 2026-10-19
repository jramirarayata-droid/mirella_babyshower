import type { EntourageGroup } from '../types/wedding'
import type { InvitationWithRSVP } from '../types/rsvp'
import type { EntourageLink } from '../services/entourageService'

const PLURALS: Record<string, string> = {
  groomsmen: 'Groomsman',
  'parents of the groom': 'Parent of the Groom',
  'parents of the bride': 'Parent of the Bride',
}

/** "Bridesmaids" → "Bridesmaid", "Principal Sponsors" → "Principal Sponsor". */
export function singularRole(title: string): string {
  const t = title.trim()
  const known = PLURALS[t.toLowerCase()]
  if (known) return known
  return /[^s]s$/i.test(t) ? t.slice(0, -1) : t
}

/** "invitationId:guestId" → position taken from the entourage (role, or the group's name). */
export function entouragePositions(groups: EntourageGroup[], links: EntourageLink[]): Map<string, string> {
  const byMember = new Map<string, { group: EntourageGroup; role: string }>()
  for (const g of groups) for (const m of g.members) byMember.set(m.id, { group: g, role: m.role })
  const out = new Map<string, string>()
  for (const l of links) {
    const hit = byMember.get(l.memberId)
    if (!hit) continue
    const key = `${l.invitationId}:${l.guestId ?? ''}`
    if (!out.has(key)) out.set(key, hit.role.trim() || singularRole(hit.group.title))
  }
  return out
}

/** The position printed under the invitee's name (honours the invitation's setting). */
export function invitationPosition(inv: Pick<InvitationWithRSVP, 'id' | 'positionMode' | 'positionLabel'>, auto: Map<string, string>): string {
  if (inv.positionMode === 'none') return ''
  if (inv.positionMode === 'custom') return inv.positionLabel.trim()
  return auto.get(`${inv.id}:`) ?? ''
}

/** The position for an on-screen card, from the invitation's setting and its entourage link. */
export function cardPosition(
  d: { positionMode: InvitationWithRSVP['positionMode']; positionLabel: string; positionMemberId: string | null },
  groups: EntourageGroup[],
): string {
  const auto = d.positionMemberId ? entouragePositions(groups, [{ memberId: d.positionMemberId, invitationId: 'card', guestId: null }]) : new Map<string, string>()
  return invitationPosition({ id: 'card', positionMode: d.positionMode, positionLabel: d.positionLabel }, auto)
}
