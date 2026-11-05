// Figures derived from a report, plus the plain-English headline. Pure, so the
// wording rules (thresholds, small-number counts) can be tested on their own.
import { OTHERS_KEY, daysIn, formatCount, formatDayLong, type AnalyticsReport, type BreakdownRow } from './analytics'
import { devicePlural, frontDoor, pageName } from './labels'

/** Below this many visitors, shares are noise: say "8 of 11", not "mostly". */
export const SMALL = 20

/** Which pane a headline token points at; hovering it highlights that pane. */
export type Focus = 'trend' | 'pages' | 'sources' | 'devices' | 'countries'

export type HeadlinePart = string | { text: string; focus: Focus }

const leader = (rows: BreakdownRow[]) => rows.find((r) => r.key !== OTHERS_KEY)

export const inRange = (report: AnalyticsReport) => report.daily.slice(-daysIn(report.range))

export function weekOnWeek(report: AnalyticsReport) {
  const last = report.daily.slice(-7).reduce((n, d) => n + d.visitors, 0)
  const before = report.daily.slice(-14, -7).reduce((n, d) => n + d.visitors, 0)
  return { last, before, change: before > 0 ? (last - before) / before : null }
}

export function busiestDay(report: AnalyticsReport) {
  const days = inRange(report)
  return days.reduce((best, d) => (d.visitors > best.visitors ? d : best), days[0])
}

/**
 * "412 visitors in the last 30 days, mostly on phones and mostly from Google
 * search. Most viewed page: Home page."
 */
export function buildHeadline(report: AnalyticsReport): HeadlinePart[] {
  const total = report.totals.visitors
  const small = total < SMALL
  const share = (n: number) => n / Math.max(total, 1)
  const parts: HeadlinePart[] = [
    { text: `${formatCount(total)} ${total === 1 ? 'visitor' : 'visitors'}`, focus: 'trend' },
    ` in the last ${daysIn(report.range)} days`,
  ]

  const clauses: HeadlinePart[][] = []
  const device = leader(report.devices)
  if (device) {
    const s = share(device.visitors)
    const where = devicePlural(device.key)
    clauses.push(
      small ? [{ text: `${device.visitors} on ${where}`, focus: 'devices' }]
      : s >= 0.55 ? [{ text: `mostly on ${where}`, focus: 'devices' }]
      : [{ text: 'on phones and computers alike', focus: 'devices' }],
    )
  }
  const door = leader(report.referrers)
  if (door) {
    const { label, kind } = frontDoor(door.key)
    const s = share(door.visitors)
    clauses.push(
      kind === 'direct' ?
        small ? [{ text: `${door.visitors} direct or from an app`, focus: 'sources' }]
        : [{ text: s >= 0.5 ? 'mostly direct or from an app' : 'most often direct or from an app', focus: 'sources' }]
      : small ? [{ text: `${door.visitors} from ${label}`, focus: 'sources' }]
      : [{ text: `${s >= 0.5 ? 'mostly' : 'most often'} from ${label}`, focus: 'sources' }],
    )
  }
  clauses.forEach((clause, i) => {
    parts.push(i === 0 ? ', ' : ' and ', ...clause)
  })
  parts.push('.')

  const page = leader(report.pages)
  if (page) {
    const { label } = pageName(page.key)
    parts.push(' Most viewed page: ', { text: label, focus: 'pages' }, '.')
  }
  return parts
}

/** One line for screen readers and the page title: the headline without tokens. */
export const headlineText = (parts: HeadlinePart[]) => parts.map((p) => (typeof p === 'string' ? p : p.text)).join('')

export const describeDay = (day: { date: string; visitors: number }) =>
  `${formatDayLong(day.date)} · ${formatCount(day.visitors)} ${day.visitors === 1 ? 'visitor' : 'visitors'}`
