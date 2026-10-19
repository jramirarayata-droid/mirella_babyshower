import { siteBaseUrl } from './share'

/** Placeholders the couple can use in the invitation message. */
export const INVITE_PLACEHOLDERS = [
  { key: '{name}', label: 'Guest’s name' },
  { key: '{date}', label: 'Wedding date' },
  { key: '{couple}', label: 'Your names' },
  { key: '{link}', label: 'Their invitation link' },
] as const

export const DEFAULT_INVITE_MESSAGE = `Hi {name}! 💌

We're getting married on {date}, and we would love for you to celebrate with us.

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

/** Fills in the message template. The link is always included, even if {link} was removed. */
export function buildInviteMessage(template: string, v: { name: string; date: string; couple: string; link: string }): string {
  const base = template.trim() ? template : DEFAULT_INVITE_MESSAGE
  const filled = base
    .replace(/\{name\}/gi, v.name)
    .replace(/\{date\}/gi, v.date)
    .replace(/\{couple\}/gi, v.couple)
    .replace(/\{link\}/gi, v.link)
  return /\{link\}/i.test(base) ? filled.trim() : `${filled.trim()}\n\n${v.link}`
}
