import { useState } from 'react'
import {
  OTHERS_KEY,
  RANGES,
  daysIn,
  formatCount,
  formatDayLong,
  formatPercent,
  formatSpan,
  type AnalyticsReport,
  type BreakdownRow,
  type Range,
} from '../../lib/analytics'
import { countryName, frontDoor, pageName, type DoorKind } from '../../lib/labels'
import { SMALL, buildHeadline, busiestDay, inRange, weekOnWeek, type Focus } from '../../lib/summary'
import BoardList from './BoardList'
import DeviceSplit from './DeviceSplit'
import TrendChart, { TrendTable, type Metric } from './TrendChart'

const KIND_NAMES: Record<DoorKind, string> = {
  search: 'search',
  social: 'social media',
  direct: 'direct or apps',
  booking: 'booking sites',
  email: 'email',
  website: 'other websites',
  other: 'elsewhere',
}

/** "52% from search": the kind of front door that brings the most visitors. */
function sourcesAside(rows: BreakdownRow[], total: number) {
  const byKind = new Map<DoorKind, number>()
  for (const r of rows) {
    const kind = frontDoor(r.key).kind ?? 'other'
    if (kind !== 'other') byKind.set(kind, (byKind.get(kind) ?? 0) + r.visitors)
  }
  const [kind, visitors] = [...byKind].sort((a, b) => b[1] - a[1])[0] ?? []
  return kind && total ? `${formatPercent(visitors! / total)} from ${KIND_NAMES[kind]}` : undefined
}

const WITH_THE: Record<string, string> = { GB: 'the UK', US: 'the US', NL: 'the Netherlands', AE: 'the UAE' }

function countriesAside(rows: BreakdownRow[], total: number) {
  const lead = rows.find((r) => r.key !== OTHERS_KEY)
  if (!lead || !total) return undefined
  return `${formatPercent(lead.visitors / total)} from ${WITH_THE[lead.key] ?? countryName(lead.key).label}`
}

function Kpis({ report }: { report: AnalyticsReport }) {
  const { visitors, pageviews } = report.totals
  const week = weekOnWeek(report)
  const busiest = busiestDay(report)
  const direction = week.last > week.before ? 'up' : week.last < week.before ? 'down' : 'flat'

  return (
    <section className="cell cell--kpis" aria-label="Headline figures">
      <dl className="kpis">
        <div className="kpi">
          <dt className="kpi__label">Visitors</dt>
          <dd className="kpi__value">{formatCount(visitors)}</dd>
          <dd className="kpi__hint">Each counted once a day</dd>
        </div>
        <div className="kpi">
          <dt className="kpi__label">Page views</dt>
          <dd className="kpi__value">{formatCount(pageviews)}</dd>
          <dd className="kpi__hint">Pages opened in total</dd>
        </div>
        <div className="kpi">
          <dt className="kpi__label">Pages per visitor</dt>
          <dd className="kpi__value">{visitors ? (pageviews / visitors).toFixed(1) : '—'}</dd>
          <dd className="kpi__hint">On average</dd>
        </div>
        <div className="kpi">
          <dt className="kpi__label">This week</dt>
          <dd className={`kpi__value kpi__value--${direction}`}>
            {week.before >= SMALL && week.change !== null ? (
              <>
                <span aria-hidden="true">{direction === 'up' ? '▲ ' : direction === 'down' ? '▼ ' : ''}</span>
                {week.change > 0 ? '+' : week.change < 0 ? '−' : ''}
                {formatPercent(Math.abs(week.change))}
              </>
            ) : (
              `${formatCount(week.last)} vs ${formatCount(week.before)}`
            )}
          </dd>
          <dd className="kpi__hint">Last 7 days vs the 7 before</dd>
        </div>
        <div className="kpi">
          <dt className="kpi__label">Busiest day</dt>
          <dd className="kpi__value kpi__value--date">{busiest ? formatDayLong(busiest.date) : '—'}</dd>
          <dd className="kpi__hint">{busiest ? `${formatCount(busiest.visitors)} visitors` : ''}</dd>
        </div>
      </dl>
    </section>
  )
}

/**
 * The Analytics tab, purely presentational: whoever renders it fetches the
 * report (the portal page in production, the dev harness locally). On a wide
 * screen it is one fixed board that fits the viewport; narrower, it stacks.
 */
export default function AnalyticsView({
  range,
  onRangeChange,
  report,
  loading,
  error,
  onRetry,
  updatedAt,
}: {
  range: Range
  onRangeChange: (range: Range) => void
  report: AnalyticsReport | null
  loading: boolean
  error: string
  onRetry: () => void
  updatedAt?: Date | null
}) {
  const [metric, setMetric] = useState<Metric>('visitors')
  const [asTable, setAsTable] = useState(false)
  const [focus, setFocus] = useState<Focus | null>(null)
  const hasData = !!report && report.totals.pageviews > 0
  const cell = (name: Focus) => (focus === null ? '' : focus === name ? 'cell--focus' : 'cell--dim')

  return (
    <div className={`analytics ${loading && report ? 'analytics--stale' : ''}`} aria-busy={loading}>
      <div className="analytics__top">
        <h1 className="headline">
          {hasData ?
            buildHeadline(report).map((part, i) =>
              typeof part === 'string' ? (
                part
              ) : (
                <span
                  key={i}
                  className="token"
                  onMouseEnter={() => setFocus(part.focus)}
                  onMouseLeave={() => setFocus(null)}
                >
                  {part.text}
                </span>
              ),
            )
          : 'Your website’s visitors'}
        </h1>
        <div className="analytics__controls">
          <div className="segmented" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                className="segmented__option"
                aria-pressed={r.value === range}
                onClick={() => onRangeChange(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
          {report && (
            <span className="analytics__span">
              {formatSpan(report.since, report.until)}
              {updatedAt && (
                <>
                  <br />
                  Updated {updatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="form__error analytics__error" role="alert">
          <span>{report ? 'Couldn’t refresh your stats. Showing the last ones loaded.' : 'Couldn’t load your stats. Vercel didn’t respond.'}</span>
          <button type="button" className="button button--ghost button--small" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {!report ? (
        !error && <p className="analytics__loading">Loading your stats…</p>
      ) : !hasData ? (
        <div className="empty analytics__empty">
          <p className="empty__title">No visits in the last {daysIn(range)} days yet</p>
          <p className="empty__text">
            When people visit your website, this page shows how many came, what they opened and how they found you.
          </p>
        </div>
      ) : (
        <div className="board-grid">
          <Kpis report={report} />

          <section className={`cell cell--trend ${cell('trend')}`} aria-label="Visitors per day">
            <header className="cell__head">
              <h2 className="cell__title">{metric === 'visitors' ? 'Visitors' : 'Page views'} per day</h2>
              <div className="cell__tools">
                <div className="segmented segmented--small" role="group" aria-label="Show">
                  <button type="button" className="segmented__option" aria-pressed={metric === 'visitors'} onClick={() => setMetric('visitors')}>
                    Visitors
                  </button>
                  <button type="button" className="segmented__option" aria-pressed={metric === 'pageviews'} onClick={() => setMetric('pageviews')}>
                    Page views
                  </button>
                </div>
                <button type="button" className="text-button" aria-pressed={asTable} onClick={() => setAsTable((t) => !t)}>
                  {asTable ? 'Chart' : 'Table'}
                </button>
              </div>
            </header>
            <div className="cell__body">
              {asTable ? <TrendTable days={inRange(report)} /> : <TrendChart days={inRange(report)} metric={metric} />}
            </div>
          </section>

          <DeviceSplit rows={report.devices} total={report.totals.visitors} className={cell('devices')} />

          <BoardList
            title="Most viewed pages"
            rows={report.pages}
            total={report.totals.visitors}
            label={pageName}
            combineOthers={false}
            aside="% of visitors who opened it"
            className={`cell--pages ${cell('pages')}`}
          />
          <BoardList
            title="How people found you"
            rows={report.referrers}
            total={report.totals.visitors}
            label={frontDoor}
            combineOthers
            aside={sourcesAside(report.referrers, report.totals.visitors)}
            className={`cell--sources ${cell('sources')}`}
          />
          <BoardList
            title="Where they are"
            rows={report.countries}
            total={report.totals.visitors}
            label={countryName}
            combineOthers
            aside={countriesAside(report.countries, report.totals.visitors)}
            className={`cell--countries ${cell('countries')}`}
          />
        </div>
      )}

      <p className="analytics__note">
        From Vercel Web Analytics, updated within minutes. Visitors are counted once per day, and people who block
        tracking aren’t counted.
      </p>
    </div>
  )
}
