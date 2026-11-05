// Sample reports for the UI harness, so the dashboard can be judged with a
// realistic amount of traffic before any client site has much.
import { daysIn, type AnalyticsReport, type BreakdownRow, type Range } from '../lib/analytics'

/** Deterministic, so a screenshot today matches one tomorrow. */
function random(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32
    return seed / 2 ** 32
  }
}

/** The last 30 days, oldest first, ending today (UTC). */
function last30() {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - (29 - i))
    return d.toISOString().slice(0, 10)
  })
}

/** Splits `total` visitors across keys by weight; page views run `ratio`× visitors (1.7 unless given). */
function split(total: number, weights: [string, number, number?][]): BreakdownRow[] {
  const sum = weights.reduce((n, [, w]) => n + w, 0)
  return weights.map(([key, w, ratio = 1.7]) => {
    const visitors = Math.max(1, Math.round((total * w) / sum))
    return { key, visitors, pageviews: Math.round(visitors * ratio) }
  })
}

function rangeOf(range: Range, daily: AnalyticsReport['daily']) {
  const days = daily.slice(-daysIn(range))
  return {
    since: days[0].date,
    until: days[days.length - 1].date,
    // Vercel counts visitors once per day, so a range is the sum of its days.
    totals: {
      visitors: days.reduce((n, d) => n + d.visitors, 0),
      pageviews: days.reduce((n, d) => n + d.pageviews, 0),
    },
  }
}

export function busyReport(range: Range): AnalyticsReport {
  const next = random(7)
  const daily = last30().map((date, i) => {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
    const base = weekday === 0 || weekday === 6 ? 22 : 46
    // A gentle climb, so the week-on-week figure has something to say.
    const visitors = Math.round((base + next() * 28) * (0.85 + (0.3 * i) / 29))
    return { date, visitors, pageviews: Math.round(visitors * (1.4 + next() * 0.6)) }
  })
  const { since, until, totals } = rangeOf(range, daily)
  const visitors = totals.visitors

  return {
    range,
    since,
    until,
    totals,
    daily,
    pages: split(visitors * 1.25, [
      ['/', 58],
      ['/booking', 24],
      ['/treatments', 18],
      ['/conditions', 14],
      ['/about', 9],
      ['/blog/sciatica-stretches-you-can-do-at-your-desk', 7],
      ['/contact', 6],
      ['/blog/getting-back-to-running-after-injury', 4],
      ['/location', 3],
      ['/blog/what-is-craniosacral-therapy', 2],
      ['Others', 5],
    ]),
    referrers: split(visitors, [
      ['www.google.com', 44],
      ['', 28],
      ['l.instagram.com', 11],
      ['com.google.android.gm', 4],
      ['www.bing.com', 4],
      ['m.facebook.com', 3],
      ['jonwsports.co.uk', 3],
      ['duckduckgo.com', 1],
      ['Others', 2],
    ]),
    devices: split(visitors, [
      ['mobile', 68, 1.5],
      ['desktop', 29, 2.3],
      ['tablet', 3, 1.9],
    ]),
    countries: split(visitors, [
      ['GB', 91],
      ['IE', 3],
      ['US', 2],
      ['ES', 1],
      ['FR', 1],
      ['DE', 1],
      ['Others', 1],
    ]),
  }
}

export function emptyReport(range: Range): AnalyticsReport {
  const daily = last30().map((date) => ({ date, visitors: 0, pageviews: 0 }))
  return {
    range,
    ...rangeOf(range, daily),
    daily,
    pages: [],
    referrers: [],
    devices: [],
    countries: [],
  }
}
