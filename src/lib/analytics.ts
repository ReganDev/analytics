// Shared by the browser and the server code in /server, so it stays free of
// imports: the report's shape plus number and date formatting.

export type Range = '7d' | '30d'

export const RANGES: { value: Range; label: string; days: number }[] = [
  { value: '7d', label: '7 days', days: 7 },
  { value: '30d', label: '30 days', days: 30 },
]

export const daysIn = (range: Range) => RANGES.find((r) => r.value === range)!.days

export interface Counts {
  /**
   * Vercel counts a visitor once per day (its visitor hash resets daily), so a
   * range's visitors equal the sum of its days and a regular counts every day
   * they come back. Labels must not call this "people".
   */
  visitors: number
  pageviews: number
}

/** One row of a "top …" list: a page path, referrer host, device type or country code. */
export interface BreakdownRow extends Counts {
  key: string
}

export type Day = { date: string } & Counts

/** Everything the Analytics tab shows. */
export interface AnalyticsReport {
  range: Range
  /** First and last day of the selected range, as YYYY-MM-DD (UTC). */
  since: string
  until: string
  totals: Counts
  /** The last 30 days whatever the range, oldest first, for the trend and week-on-week. */
  daily: Day[]
  pages: BreakdownRow[]
  referrers: BreakdownRow[]
  devices: BreakdownRow[]
  countries: BreakdownRow[]
}

/** Vercel folds everything past the requested limit into a row with this key. */
export const OTHERS_KEY = 'Others'

const compact = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat('en-GB')

/** 1,284 below ten thousand; 12.9K above, so figures never overflow. */
export function formatCount(n: number) {
  return n < 10_000 ? whole.format(n) : compact.format(n)
}

export const formatPercent = (share: number) => `${Math.round(share * 100)}%`

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const dayMonthYear = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const weekdayDayMonth = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

const asDate = (isoDay: string) => new Date(`${isoDay}T00:00:00Z`)

export const formatDay = (isoDay: string) => dayMonth.format(asDate(isoDay))
export const formatDayLong = (isoDay: string) => weekdayDayMonth.format(asDate(isoDay))

/** "1 Oct – 28 Oct 2026" */
export function formatSpan(since: string, until: string) {
  return `${formatDay(since)} – ${dayMonthYear.format(asDate(until))}`
}
