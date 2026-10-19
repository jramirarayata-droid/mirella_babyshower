/*
 * Suggestions for how an invitation is addressed ("Mr. & Mrs. Juan dela Cruz").
 * Only suggestions: nothing is filled in until the couple picks or types one.
 */

/** Words that belong to the surname in front of it: "dela Cruz", "de los Santos", "San Juan". */
const PARTICLES = new Set(['de', 'del', 'dela', 'della', 'la', 'las', 'los', 'delos', 'san', 'santa', 'sta.', 'sto.', 'van', 'von', 'da', 'di', 'du', 'le', 'mc'])
const SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i

export interface NameParts {
  first: string
  last: string
  /** "Jr." etc. */
  suffix: string
}

/** "Juan Miguel dela Cruz Jr." → first "Juan Miguel", last "dela Cruz", suffix "Jr." */
export function splitName(full: string): NameParts {
  const words = full.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  let suffix = ''
  if (words.length > 2 && SUFFIX.test(words[words.length - 1].replace(/,$/, ''))) suffix = words.pop()!.replace(/,$/, '')
  if (words.length < 2) return { first: words.join(' '), last: '', suffix }
  let i = words.length - 1
  while (i - 1 >= 1 && PARTICLES.has(words[i - 1].toLowerCase())) i--
  return { first: words.slice(0, i).join(' '), last: words.slice(i).join(' '), suffix }
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const withSuffix = (p: NameParts) => (p.suffix ? `${p.first} ${p.last} ${p.suffix}` : `${p.first} ${p.last}`).trim()

/** Ready-made ways to address an invitation, from its names. Best first, no duplicates. */
export function addressSuggestions(invitee: string, included: string[]): string[] {
  const a = splitName(invitee)
  const others = included.map(splitName).filter((p) => p.first)
  const out: string[] = []
  const add = (s: string) => {
    const v = s.replace(/\s+/g, ' ').trim()
    if (v && !same(v, invitee) && !out.some((x) => same(x, v))) out.push(v)
  }

  if (others.length === 1) {
    const b = others[0]
    const sameSurname = a.last && b.last && same(a.last, b.last)
    add(`Mr. & Mrs. ${withSuffix(a)}`)
    if (sameSurname) {
      add(`${a.first} & ${b.first} ${a.last}`)
      add(`Mr. & Mrs. ${withSuffix(b)}`)
    } else {
      add(`${withSuffix(a)} & ${withSuffix(b)}`)
    }
    add(`${a.first} & ${b.first}`)
  } else if (others.length > 1) {
    if (a.last) add(`The ${a.last} Family`)
    add(`Mr. & Mrs. ${withSuffix(a)} & Family`)
    add(`${withSuffix(a)} & Family`)
  } else {
    add(`Mr. ${withSuffix(a)}`)
    add(`Ms. ${withSuffix(a)}`)
    add(`Mrs. ${withSuffix(a)}`)
  }
  return out
}

/** Titles that can be put in front of whatever is typed. */
export const ADDRESS_TITLES = ['Mr. & Mrs.', 'Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Dr. & Mrs.', 'Engr. & Mrs.', 'Atty. & Mrs.', 'Hon. & Mrs.', 'Rev.'] as const

const LEADING_TITLE = /^((mr|mrs|ms|miss|dr|engr|atty|hon|rev|arch|capt|col|gen|prof|sen|gov|mayor)\.?(\s*&\s*(mr|mrs|ms|dr)\.?)?)\s+/i

/** Puts a title in front, replacing one that's already there: ("Mr. Juan", "Dr. & Mrs.") → "Dr. & Mrs. Juan". */
export function withTitle(text: string, title: string): string {
  const rest = text.replace(/\s+/g, ' ').trim().replace(LEADING_TITLE, '')
  return `${title} ${rest}`.trim()
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length

/**
 * How an "addressed as" is laid out: one line per person, joined by "&".
 * "Mr. Joey Montes & Mrs. Vivian Montes" → ["Mr. Joey Montes", "Mrs. Vivian Montes"]
 * — but a "&" between titles or before a single word stays on its line:
 * "Mr. & Mrs. Juan dela Cruz", "Juan & Maria dela Cruz", "… & Family".
 */
export function addressLines(text: string): string[] {
  const parts = text.replace(/\s+/g, ' ').trim().split(/\s+&\s+/)
  const lines: string[] = []
  let cur = parts[0] ?? ''
  for (const next of parts.slice(1)) {
    if (words(cur) >= 2 && words(next) >= 2) {
      lines.push(cur)
      cur = next
    } else {
      cur = `${cur} & ${next}`
    }
  }
  lines.push(cur)
  return lines.filter(Boolean)
}
