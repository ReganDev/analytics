import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAnalyticsReport, rangeDates } from '../api/analytics.ts'

afterEach(() => vi.unstubAllGlobals())

const NOW = new Date('2026-10-28T23:15:00.000Z')

describe('rangeDates', () => {
  it('covers whole UTC days ending today', () => {
    expect(rangeDates('7d', NOW)).toEqual({ since: '2026-10-22', until: '2026-10-28' })
    expect(rangeDates('30d', NOW)).toEqual({ since: '2026-09-29', until: '2026-10-28' })
  })
})

describe('fetchAnalyticsReport', () => {
  it('asks Vercel for exact instants so today’s visits are counted', async () => {
    const urls: URL[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        urls.push(new URL(String(input)))
        return new Response(JSON.stringify({ data: [] }))
      }),
    )
    await fetchAnalyticsReport({ token: 't', teamId: 'team_1', projectId: 'prj_1' }, '7d', NOW)
    const totals = urls.find((u) => u.searchParams.get('by') === 'environment')!
    expect(totals.searchParams.get('since')).toBe('2026-10-22T00:00:00.000Z')
    expect(totals.searchParams.get('until')).toBe(NOW.toISOString())
    // The daily series is always 30 days, for the week-on-week figure.
    const daily = urls.find((u) => u.searchParams.get('by') === 'day')!
    expect(daily.searchParams.get('since')).toBe('2026-09-29T00:00:00.000Z')
  })

  it('drops the spill-over day Vercel adds when rounding to days', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL) => {
        const by = new URL(String(input)).searchParams.get('by')
        const data =
          by === 'day' ?
            [
              { timestamp: '2026-10-28T00:00:00.000Z', visitors: 3, pageviews: 4 },
              { timestamp: '2026-10-29T00:00:00.000Z', visitors: 0, pageviews: 0 },
            ]
          : []
        return new Response(JSON.stringify({ data }))
      }),
    )
    const report = await fetchAnalyticsReport({ token: 't', teamId: 'team_1', projectId: 'prj_1' }, '30d', NOW)
    expect(report.daily).toEqual([{ date: '2026-10-28', visitors: 3, pageviews: 4 }])
    expect(report.totals).toEqual({ visitors: 0, pageviews: 0 })
  })
})
