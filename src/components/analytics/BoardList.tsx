import { useId, type ReactNode } from 'react'
import { OTHERS_KEY, formatCount, formatPercent, type BreakdownRow } from '../../lib/analytics'
import type { Label } from '../../lib/labels'

const SLOTS = 5

/**
 * A departure-board list: always exactly five fixed-height rows, so the page
 * fits one screen whatever the data, with the rest behind "+N more". Each row
 * carries a hairline meter of its share of all visitors, on one scale across
 * every board, so 40% looks the same everywhere.
 */
export default function BoardList({
  title,
  aside,
  rows,
  total,
  label,
  combineOthers,
  className = '',
}: {
  title: string
  aside?: ReactNode
  rows: BreakdownRow[]
  /** All visitors in the range: shares are of this, not of the rows shown. */
  total: number
  label: (key: string) => Label
  /** Sources and countries split visitors cleanly, so "Other 12%" is true; pages don't. */
  combineOthers: boolean
  className?: string
}) {
  const headingId = useId()
  const named = rows.filter((r) => r.key !== OTHERS_KEY)
  const others = rows.find((r) => r.key === OTHERS_KEY)
  const shown = named.slice(0, SLOTS)
  const hidden = named.slice(SLOTS)
  const hiddenVisitors = hidden.reduce((n, r) => n + r.visitors, 0) + (others?.visitors ?? 0)
  const share = (n: number) => n / Math.max(total, 1)

  const row = (r: BreakdownRow, rank: number) => {
    const { label: text, detail } = label(r.key)
    return (
      <li key={r.key} className="board__row">
        <span className="board__rank" aria-hidden="true">
          {String(rank).padStart(2, '0')}
        </span>
        <span className="board__label">
          <span className="board__text" title={text}>
            {text}
          </span>
          {detail && detail !== text && (
            <span className="board__detail" title={detail}>
              {detail}
            </span>
          )}
        </span>
        <span className="board__value">{formatCount(r.visitors)}</span>
        <span className="board__share">{formatPercent(share(r.visitors))}</span>
        <span className="board__meter" style={{ width: formatPercent(share(r.visitors)) }} aria-hidden="true" />
      </li>
    )
  }

  return (
    <section className={`cell cell--board ${className}`} aria-labelledby={headingId}>
      <header className="cell__head">
        <h2 id={headingId} className="cell__title">
          {title}
        </h2>
        {aside && <span className="cell__aside">{aside}</span>}
      </header>

      <ol className="board">
        {shown.map((r, i) => row(r, i + 1))}
        {Array.from({ length: SLOTS - shown.length }, (_, i) => (
          <li key={`empty-${i}`} className="board__row board__row--empty" aria-hidden="true">
            <span className="board__rank">{String(shown.length + i + 1).padStart(2, '0')}</span>
            <span className="board__label">
              <span className="board__text">{shown.length === 0 && i === 0 ? 'Nothing yet' : '—'}</span>
            </span>
          </li>
        ))}
      </ol>

      <footer className="board__foot">
        {hidden.length > 0 || others ? (
          <details className="more">
            <summary>
              {hidden.length > 0 ? `+${hidden.length} more` : 'More'}
              {combineOthers && hiddenVisitors > 0 && ` · ${formatPercent(share(hiddenVisitors))} of visitors`}
            </summary>
            <ol className="more__panel board">
              {named.map((r, i) => row(r, i + 1))}
              {others && row(others, named.length + 1)}
            </ol>
          </details>
        ) : (
          <span className="board__foot-note">{named.length === 0 ? '' : 'That’s everything'}</span>
        )}
      </footer>
    </section>
  )
}
