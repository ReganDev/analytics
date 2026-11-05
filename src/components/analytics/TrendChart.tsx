import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { formatCount, formatDay, formatDayLong, type Day } from '../../lib/analytics'

export type Metric = 'visitors' | 'pageviews'

const TOP = 14
const AXIS_H = 26
const LEFT = 38
const RIGHT = 20

/** Clean integer ticks (0, 1, 2 · 0, 25, 50 · 0, 1K, 2K): at most four steps above zero. */
function ticksFor(max: number) {
  const target = Math.max(max, 1) / 4
  const magnitude = 10 ** Math.floor(Math.log10(target))
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= target) ?? magnitude * 10)
  const top = Math.ceil(Math.max(max, 1) / step) * step
  return Array.from({ length: top / step + 1 }, (_, i) => i * step)
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) }),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}

/**
 * The board's one bold element: an amber trace of the day-by-day series that
 * draws itself once on load. A crosshair snaps to the nearest day on hover,
 * touch or arrow keys; every value is also in the table view.
 */
export default function TrendChart({ days, metric }: { days: Day[]; metric: Metric }) {
  const [ref, { width, height }] = useSize<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const gradientId = useId()

  const plotW = Math.max(width - LEFT - RIGHT, 0)
  const plotH = Math.max(height - TOP - AXIS_H, 60)
  const baseline = TOP + plotH
  const ticks = ticksFor(Math.max(...days.map((d) => d[metric])))
  const yMax = ticks[ticks.length - 1]
  const step = days.length > 1 ? plotW / (days.length - 1) : 0
  const x = (i: number) => LEFT + (days.length > 1 ? i * step : plotW / 2)
  const y = (v: number) => baseline - (v / yMax) * plotH

  const line = days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[metric]).toFixed(1)}`).join('')
  const area = days.length ? `${line}L${x(days.length - 1)},${baseline}L${x(0)},${baseline}Z` : ''

  // Label from the most recent day backwards, as many as fit without colliding.
  const every = Math.max(1, Math.ceil(days.length / Math.max(1, Math.floor(plotW / 70))))
  const labelled = (i: number) => (days.length - 1 - i) % every === 0

  function nearest(event: PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const i = step ? Math.round((event.clientX - box.left) / step) : 0
    setActive(Math.min(days.length - 1, Math.max(0, i)))
  }

  function onKeyDown(event: KeyboardEvent) {
    const last = days.length - 1
    const current = active ?? last
    const next =
      event.key === 'ArrowLeft' ? Math.max(0, current - 1)
      : event.key === 'ArrowRight' ? Math.min(last, current + 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null
    if (next === null) return
    event.preventDefault()
    setActive(next)
  }

  const day = active === null ? null : days[active]
  const lastIndex = days.length - 1

  return (
    <div
      ref={ref}
      className="trend"
      tabIndex={0}
      role="group"
      aria-label={`${metric === 'visitors' ? 'Visitors' : 'Page views'} per day. Use the left and right arrow keys to read each day.`}
      onKeyDown={onKeyDown}
      onFocus={() => setActive((a) => a ?? lastIndex)}
      onBlur={() => setActive(null)}
    >
      {width > 0 && height > 0 && (
        <svg width={width} height={height} aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--data)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--data)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line className="trend__grid" x1={LEFT} x2={width - RIGHT} y1={y(t)} y2={y(t)} />
              <text className="trend__tick" x={LEFT - 10} y={y(t)} dy="0.32em" textAnchor="end">
                {formatCount(t)}
              </text>
            </g>
          ))}

          {days.map((d, i) =>
            labelled(i) ? (
              <text key={d.date} className="trend__tick" x={x(i)} y={baseline + 18} textAnchor="middle">
                {formatDay(d.date)}
              </text>
            ) : null,
          )}

          <path className="trend__area" d={area} fill={`url(#${gradientId})`} />
          <path className="trend__line" d={line} pathLength={1} />

          {day && active !== null ? (
            <>
              <line className="trend__cross" x1={x(active)} x2={x(active)} y1={TOP} y2={baseline} />
              <circle className="trend__dot" cx={x(active)} cy={y(day[metric])} r={4.5} />
            </>
          ) : (
            lastIndex >= 0 && <circle className="trend__dot trend__dot--end" cx={x(lastIndex)} cy={y(days[lastIndex][metric])} r={4} />
          )}

          <rect
            x={LEFT - step / 2}
            y={TOP}
            width={plotW + step}
            height={plotH}
            fill="transparent"
            onPointerMove={nearest}
            onPointerDown={nearest}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      )}

      {day && active !== null && (
        <div
          className="trend__tip"
          style={{ left: Math.min(Math.max(x(active), 80), width - 80), top: Math.max(y(day[metric]) - 76, 0) }}
          aria-live="polite"
        >
          <div className="trend__tip-date">{formatDayLong(day.date)}</div>
          <div className="trend__tip-row">
            <span className={`trend__key ${metric === 'visitors' ? '' : 'trend__key--none'}`} aria-hidden="true" />
            <strong>{formatCount(day.visitors)}</strong> {day.visitors === 1 ? 'visitor' : 'visitors'}
          </div>
          <div className="trend__tip-row">
            <span className={`trend__key ${metric === 'pageviews' ? '' : 'trend__key--none'}`} aria-hidden="true" />
            <strong>{formatCount(day.pageviews)}</strong> {day.pageviews === 1 ? 'page view' : 'page views'}
          </div>
        </div>
      )}
    </div>
  )
}

/** The chart's table twin: every value readable without hovering. */
export function TrendTable({ days }: { days: Day[] }) {
  return (
    <div className="datatable">
      <table>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Visitors</th>
            <th scope="col">Page views</th>
          </tr>
        </thead>
        <tbody>
          {[...days].reverse().map((d) => (
            <tr key={d.date}>
              <th scope="row">{formatDayLong(d.date)}</th>
              <td>{formatCount(d.visitors)}</td>
              <td>{formatCount(d.pageviews)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
