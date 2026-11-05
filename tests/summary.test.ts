import { describe, expect, it } from 'vitest'
import type { AnalyticsReport } from '../src/lib/analytics.ts'
import { frontDoor, pageName } from '../src/lib/labels.ts'
import { buildHeadline, headlineText, weekOnWeek } from '../src/lib/summary.ts'

function report(over: Partial<AnalyticsReport> = {}): AnalyticsReport {
  return {
    range: '30d',
    since: '2026-09-29',
    until: '2026-10-28',
    totals: { visitors: 400, pageviews: 700 },
    daily: [],
    pages: [{ key: '/', visitors: 200, pageviews: 300 }],
    referrers: [{ key: 'www.google.com', visitors: 220, pageviews: 400 }],
    devices: [{ key: 'mobile', visitors: 280, pageviews: 450 }],
    countries: [{ key: 'GB', visitors: 380, pageviews: 660 }],
    ...over,
  }
}

describe('buildHeadline', () => {
  it('speaks in shares once there are enough visitors', () => {
    expect(headlineText(buildHeadline(report()))).toBe(
      '400 visitors in the last 30 days, mostly on phones and mostly from Google search. Most viewed page: Home page.',
    )
  })

  it('switches to plain counts when numbers are small', () => {
    const text = headlineText(
      buildHeadline(
        report({
          totals: { visitors: 11, pageviews: 20 },
          devices: [{ key: 'desktop', visitors: 8, pageviews: 15 }],
          referrers: [{ key: '', visitors: 9, pageviews: 16 }],
        }),
      ),
    )
    expect(text).toContain('11 visitors in the last 30 days, 8 on computers and 9 direct or from an app.')
  })

  it('doesn’t claim "mostly" for a split audience', () => {
    const text = headlineText(
      buildHeadline(
        report({
          devices: [{ key: 'mobile', visitors: 200, pageviews: 300 }],
          referrers: [{ key: 'l.instagram.com', visitors: 120, pageviews: 200 }],
        }),
      ),
    )
    expect(text).toContain('on phones and computers alike')
    expect(text).toContain('most often from Instagram')
  })

  it('skips the "Others" bucket when naming the leader', () => {
    const text = headlineText(
      buildHeadline(report({ pages: [{ key: 'Others', visitors: 300, pageviews: 400 }, { key: '/booking', visitors: 50, pageviews: 60 }] })),
    )
    expect(text).toContain('Most viewed page: Booking.')
  })
})

describe('weekOnWeek', () => {
  it('compares the last 7 days with the 7 before', () => {
    const daily = Array.from({ length: 14 }, (_, i) => ({ date: `d${i}`, visitors: i < 7 ? 10 : 15, pageviews: 0 }))
    expect(weekOnWeek(report({ daily }))).toEqual({ last: 105, before: 70, change: 0.5 })
  })

  it('has no percentage when the week before was empty', () => {
    const daily = Array.from({ length: 14 }, (_, i) => ({ date: `d${i}`, visitors: i < 7 ? 0 : 3, pageviews: 0 }))
    expect(weekOnWeek(report({ daily })).change).toBeNull()
  })
})

describe('labels', () => {
  it.each([
    ['www.google.com', 'Google search'],
    ['google.co.uk', 'Google search'],
    ['l.instagram.com', 'Instagram'],
    ['m.facebook.com', 'Facebook'],
    ['com.google.android.gm', 'Gmail app'],
    ['booksy.com', 'Booksy'],
    ['', 'Direct or untracked'],
    ['www.jonwsports.co.uk', 'jonwsports.co.uk'],
  ])('front door for %j is %j', (host, label) => {
    expect(frontDoor(host).label).toBe(label)
  })

  it('names pages from their paths', () => {
    expect(pageName('/').label).toBe('Home page')
    expect(pageName('/blog/sciatica-stretches').label).toBe('Blog › Sciatica stretches')
    expect(pageName('/blog/sciatica-stretches').detail).toBe('/blog/sciatica-stretches')
  })
})
