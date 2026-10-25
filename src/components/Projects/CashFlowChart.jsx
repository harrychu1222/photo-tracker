import { dayNumber, niceTicks } from '../../lib/cashflow'
import { fmtDate } from '../../lib/format'

const W = 360
const H = 230
const M = { l: 54, r: 12, t: 12, b: 30 }
const COLORS = { spent: '#c2410c', received: '#15803d', net: '#334155', quote: '#94a3b8' }

const compact = (v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))

// Plain SVG line chart of cumulative spent / received (and optionally net) over time.
export default function CashFlowChart({ data, showNet, label }) {
  const { points, quote, min, max } = data
  const ticks = niceTicks(Math.min(min, 0), max)
  const y0 = ticks[0]
  const y1 = ticks[ticks.length - 1] || 1
  const x0 = points[0].day
  const x1 = points[points.length - 1].day
  const X = (d) => (x1 === x0 ? M.l + (W - M.l - M.r) / 2 : M.l + ((d - x0) / (x1 - x0)) * (W - M.l - M.r))
  const Y = (v) => M.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - M.t - M.b)
  const line = (key) => points.map((p, i) => `${i ? 'L' : 'M'}${X(p.day).toFixed(1)},${Y(p[key]).toFixed(1)}`).join(' ')
  const series = [
    { key: 'spent', name: 'Spent' },
    { key: 'received', name: 'Received' },
    ...(showNet ? [{ key: 'net', name: 'Net (received − spent)', dash: '4 3' }] : [])
  ]
  const last = points[points.length - 1]
  const mid = points[Math.floor((points.length - 1) / 2)]

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? '#64748b' : '#e2e8f0'} strokeWidth={v === 0 ? 1 : 0.7} />
            <text x={M.l - 6} y={Y(v) + 3} textAnchor="end" fontSize="9" fill="#64748b">
              {compact(v)}
            </text>
          </g>
        ))}
        {quote != null && quote <= y1 && (
          <g>
            <line x1={M.l} x2={W - M.r} y1={Y(quote)} y2={Y(quote)} stroke={COLORS.quote} strokeDasharray="2 3" strokeWidth="1" />
            <text x={W - M.r} y={Y(quote) - 3} textAnchor="end" fontSize="9" fill="#64748b">
              Quote
            </text>
          </g>
        )}
        {series.map((s) => (
          <g key={s.key}>
            <path d={line(s.key)} fill="none" stroke={COLORS[s.key]} strokeWidth="2" strokeDasharray={s.dash} strokeLinejoin="round" />
            {points.map((p) => (
              <circle key={p.date} cx={X(p.day)} cy={Y(p[s.key])} r="2.5" fill={COLORS[s.key]} />
            ))}
          </g>
        ))}
        <text x={X(points[0].day)} y={H - 10} textAnchor={points.length > 1 ? 'start' : 'middle'} fontSize="9" fill="#64748b">
          {fmtDate(points[0].date)}
        </text>
        {points.length > 1 && (
          <text x={X(last.day)} y={H - 10} textAnchor="end" fontSize="9" fill="#64748b">
            {fmtDate(last.date)}
          </text>
        )}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: COLORS[s.key] }} />
            {s.name}
          </li>
        ))}
        {quote != null && (
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: COLORS.quote }} />
            Quote price
          </li>
        )}
      </ul>
    </div>
  )
}
