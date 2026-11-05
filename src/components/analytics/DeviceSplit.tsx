import { useId } from 'react'
import { OTHERS_KEY, formatCount, formatPercent, type BreakdownRow } from '../../lib/analytics'
import { deviceName } from '../../lib/labels'
import { SMALL } from '../../lib/summary'

/** Devices as one plain headline ("7 in 10 on a phone") over a meter per device. */
export default function DeviceSplit({ rows, total, className = '' }: { rows: BreakdownRow[]; total: number; className?: string }) {
  const headingId = useId()
  const named = rows.filter((r) => r.key !== OTHERS_KEY)
  const lead = named[0]
  const share = (n: number) => n / Math.max(total, 1)

  let headline = 'No visits yet'
  if (lead) {
    const noun = deviceName(lead.key).label.toLowerCase()
    headline =
      total < SMALL ? `${lead.visitors} of ${total} on a ${noun}`
      : `${Math.max(1, Math.round(share(lead.visitors) * 10))} in 10 on a ${noun}`
  }

  return (
    <section className={`cell cell--devices ${className}`} aria-labelledby={headingId}>
      <header className="cell__head">
        <h2 id={headingId} className="cell__title">
          Devices
        </h2>
      </header>
      <p className="devices__headline">{headline}</p>
      <ul className="devices">
        {named.map((r) => (
          <li key={r.key} className="devices__row">
            <span className="devices__label">{deviceName(r.key).label}</span>
            <span className="devices__share">{formatPercent(share(r.visitors))}</span>
            <span className="devices__track" aria-hidden="true">
              <span className="devices__fill" style={{ width: formatPercent(share(r.visitors)) }} />
            </span>
            <span className="devices__meta">
              {formatCount(r.visitors)} {r.visitors === 1 ? 'visitor' : 'visitors'}
              {r.visitors > 0 && ` · ${(r.pageviews / r.visitors).toFixed(1)} pages each`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
