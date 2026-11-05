// Turns Vercel's raw values into words a shop owner uses: hostnames become the
// "front doors" people came through, paths become page names. Every label
// keeps its raw value so the board can show it underneath.
import { OTHERS_KEY } from './analytics'

export type DoorKind = 'search' | 'social' | 'email' | 'booking' | 'direct' | 'website' | 'other'

export interface Label {
  label: string
  /** Shown dim underneath: the raw value, or a plain explanation of it. */
  detail: string
  kind?: DoorKind
}

const EXACT: Record<string, [string, DoorKind]> = {
  'com.google.android.gm': ['Gmail app', 'email'],
  'mail.google.com': ['Gmail', 'email'],
  'com.google.android.googlequicksearchbox': ['Google app', 'search'],
  'outlook.live.com': ['Outlook', 'email'],
  'outlook.office.com': ['Outlook', 'email'],
  'booksy.com': ['Booksy', 'booking'],
  'treatwell.co.uk': ['Treatwell', 'booking'],
  'fresha.com': ['Fresha', 'booking'],
  'linktr.ee': ['Linktree', 'social'],
  't.co': ['X (Twitter)', 'social'],
  'chatgpt.com': ['ChatGPT', 'search'],
}

const PATTERNS: [RegExp, string, DoorKind][] = [
  [/(^|\.)google\.[a-z.]+$/, 'Google search', 'search'],
  [/(^|\.)bing\.com$/, 'Bing search', 'search'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo', 'search'],
  [/(^|\.)yahoo\.[a-z.]+$/, 'Yahoo search', 'search'],
  [/(^|\.)ecosia\.org$/, 'Ecosia', 'search'],
  [/(^|\.)instagram\.com$/, 'Instagram', 'social'],
  [/(^|\.)(facebook|fb)\.com$/, 'Facebook', 'social'],
  [/(^|\.)tiktok\.com$/, 'TikTok', 'social'],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'LinkedIn', 'social'],
  [/(^|\.)whatsapp\.(com|net)$/, 'WhatsApp', 'social'],
  [/(^|\.)youtube\.com$/, 'YouTube', 'social'],
  [/(^|\.)pinterest\.[a-z.]+$/, 'Pinterest', 'social'],
  [/(^|\.)reddit\.com$/, 'Reddit', 'social'],
  [/(^|\.)nextdoor\.[a-z.]+$/, 'Nextdoor', 'social'],
]

/**
 * An empty referrer is honest about what it is: typed addresses and bookmarks,
 * but also in-app browsers (Instagram, WhatsApp), QR codes and email apps that
 * strip the referrer. Calling it "typed your address" would mislead.
 */
export function frontDoor(host: string): Label {
  if (host === OTHERS_KEY) return { label: 'Everywhere else', detail: 'Smaller sources combined', kind: 'other' }
  if (host === '') return { label: 'Direct or untracked', detail: 'Typed, bookmarked or opened from an app', kind: 'direct' }
  const h = host.toLowerCase().replace(/^www\./, '')
  const exact = EXACT[h]
  if (exact) return { label: exact[0], detail: host, kind: exact[1] }
  const match = PATTERNS.find(([pattern]) => pattern.test(h))
  if (match) return { label: match[1], detail: host, kind: match[2] }
  return { label: h, detail: 'Link from another website', kind: 'website' }
}

const humanise = (segment: string) => {
  let words = segment
  try {
    words = decodeURIComponent(segment)
  } catch {
    // keep the raw segment
  }
  words = words.replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** "/" → "Home page"; "/blog/sciatica-stretches" → "Blog › Sciatica stretches". */
export function pageName(path: string): Label {
  if (path === OTHERS_KEY) return { label: 'Other pages', detail: 'Smaller pages combined' }
  if (path === '/' || path === '') return { label: 'Home page', detail: '/' }
  const label = path.split('/').filter(Boolean).map(humanise).join(' › ')
  return { label: label || path, detail: path }
}

const regionNames = new Intl.DisplayNames(['en-GB'], { type: 'region' })

export function countryName(code: string): Label {
  if (code === OTHERS_KEY) return { label: 'Elsewhere', detail: 'Other countries combined' }
  let label = code || 'Unknown'
  try {
    label = (code && regionNames.of(code)) || label
  } catch {
    // not an ISO region code: show it as-is
  }
  return { label, detail: code }
}

const DEVICES: Record<string, [string, string]> = {
  mobile: ['Phone', 'phones'],
  desktop: ['Computer', 'computers'],
  tablet: ['Tablet', 'tablets'],
}

export function deviceName(key: string): Label {
  if (key === OTHERS_KEY) return { label: 'Other', detail: '' }
  return { label: DEVICES[key]?.[0] ?? (key || 'Unknown'), detail: key }
}

/** "phones", "computers": for sentences. */
export const devicePlural = (key: string) => DEVICES[key]?.[1] ?? 'other devices'
