import { siteBaseUrl } from './share'

/** Placeholders that can be used in the invitation message. */
export const INVITE_PLACEHOLDERS = [
  { key: '{name}', label: 'Guest’s name' },
  { key: '{date}', label: 'Shower date' },
  { key: '{couple}', label: 'Your names' },
  { key: '{link}', label: 'Their invitation link' },
] as const

export const DEFAULT_INVITE_MESSAGE = `Hi {name}! 💌

A little one is on the way! 🍼 We're having a baby shower on {date}, and we would love for you to celebrate with us.

Here's your invitation — just tap to open it:
{link}

With love,
{couple}`

/**
 * The guest's personal virtual invitation, e.g. https://…/i/?c=ab12cd34ef —
 * a small share page with its own Messenger preview that opens /#/i/<code>.
 * (Links in the older /#/i/<code> form keep working.)
 */
export function virtualInviteUrl(code: string): string {
  return `${siteBaseUrl().replace(/index\.html$/, '')}i/?c=${encodeURIComponent(code)}`
}

/**
 * Fills in the message template. The link is always included, even if {link}
 * was removed — unless the message already contains it (e.g. typed in by hand).
 */
export function buildInviteMessage(template: string, v: { name: string; date: string; couple: string; link: string }): string {
  const base = template.trim() ? template : DEFAULT_INVITE_MESSAGE
  const filled = base
    .replace(/\{name\}/gi, v.name)
    .replace(/\{date\}/gi, v.date)
    .replace(/\{couple\}/gi, v.couple)
    .replace(/\{link\}/gi, v.link)
  if (/\{link\}/i.test(base) || !v.link || filled.includes(v.link)) return filled.trim()
  return `${filled.trim()}\n\n${v.link}`
}
