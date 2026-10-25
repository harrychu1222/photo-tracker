import { useState } from 'react'
import { niceTicks } from '../../lib/cashflow'
import { fmtDate, fmtMoney } from '../../lib/format'

const W = 360
const H = 240
const M = { l: 52, r: 58, t: 14, b: 30 }
const COLORS = { spent: '#c2410c', received: '#15803d', net: '#334155', quote: '#64748b' }

const dollars = (v) => `${v < 0 ? '-' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-AU')}`

// Spread labels vertically so end-of-line figures never sit on top of each other.
function spreadLabels(items, minGap = 11) {
  const sorted = [...items].sort((a, b) => a.y - b.y)
  for (let i = 1; i < sorted.length; i++) if (sorted[i].y - sorted[i - 1].y < minGap) sorted[i].y = sorted[i - 1].y + minGap
  return sorted
}

// Plain SVG line chart of cumulative spent / received (and optionally net) over time.
// Tap or drag across it to read exact figures for any date; the latest figures show by default.
export default function CashFlowChart({ data, showNet, label }) {
  const { points, quote, min, max } = data
  const [picked, setPicked] = useState(null)
  const sel = picked != null && picked < points.length ? picked : points.length - 1
  const ticks = niceTicks(Math.min(min, 0), max)
  const y0 = ticks[0]
  const y1 = ticks[ticks.length - 1] || 1
  const x0 = points[0].day
  const x1 = points[points.length - 1].day
  const plotW = W - M.l - M.r
  const X = (d) => (x1 === x0 ? M.l + plotW / 2 : M.l + ((d - x0) / (x1 - x0)) * plotW)
  const Y = (v) => M.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - M.t - M.b)
  const line = (key) => points.map((p, i) => `${i ? 'L' : 'M'}${X(p.day).toFixed(1)},${Y(p[key]).toFixed(1)}`).join(' ')
  const series = [
    { key: 'spent', name: 'Spent' },
    { key: 'received', name: 'Received' },
    ...(showNet ? [{ key: 'net', name: 'Net', dash: '4 3' }] : [])
  ]
  const last = points[points.length - 1]
  const cur = points[sel]

  const ends = spreadLabels([
    ...series.map((s) => ({ key: s.key, color: COLORS[s.key], y: Y(last[s.key]) + 3, text: dollars(last[s.key]) })),
    ...(quote != null && quote <= y1 ? [{ key: 'quote', color: COLORS.quote, y: Y(quote) + 3, text: dollars(quote) }] : [])
  ])

  function pick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const vx = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    points.forEach((p, i) => {
      if (Math.abs(X(p.day) - vx) < Math.abs(X(points[best].day) - vx)) best = i
    })
    setPicked(best)
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        className="w-full touch-pan-y select-none"
        onPointerDown={pick}
        onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && pick(e)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} stroke={v === 0 ? '#64748b' : '#e2e8f0'} strokeWidth={v === 0 ? 1 : 0.7} />
            <text x={M.l - 5} y={Y(v) + 3} textAnchor="end" fontSize="9" fill="#475569">
              {dollars(v)}
            </text>
          </g>
        ))}
        {quote != null && quote <= y1 && (
          <line x1={M.l} x2={W - M.r} y1={Y(quote)} y2={Y(quote)} stroke={COLORS.quote} strokeDasharray="2 3" strokeWidth="1" opacity="0.6" />
        )}
        {quote != null && quote <= y1 && (
          <text x={M.l + 3} y={Y(quote) - 3} fontSize="9" fill={COLORS.quote}>
            Quote price
          </text>
        )}
        <line x1={X(cur.day)} x2={X(cur.day)} y1={M.t} y2={H - M.b} stroke="#94a3b8" strokeWidth="1" />
        {series.map((s) => (
          <g key={s.key}>
            <path d={line(s.key)} fill="none" stroke={COLORS[s.key]} strokeWidth="2" strokeDasharray={s.dash} strokeLinejoin="round" />
            {points.map((p, i) => (
              <circle key={p.date} cx={X(p.day)} cy={Y(p[s.key])} r={i === sel ? 4.5 : 2.5} fill={COLORS[s.key]} stroke={i === sel ? '#fff' : 'none'} strokeWidth="1.5" />
            ))}
          </g>
        ))}
        {ends.map((e) => (
          <text key={e.key} x={W - M.r + 5} y={e.y} fontSize="9" fontWeight="600" fill={e.color}>
            {e.text}
          </text>
        ))}
        <text x={X(points[0].day)} y={H - 10} textAnchor={points.length > 1 ? 'start' : 'middle'} fontSize="9" fill="#475569">
          {fmtDate(points[0].date)}
        </text>
        {points.length > 1 && (
          <text x={X(last.day)} y={H - 10} textAnchor="end" fontSize="9" fill="#475569">
            {fmtDate(last.date)}
          </text>
        )}
      </svg>

      <div className="mt-1 rounded-lg bg-ink-50 px-3 py-2 text-sm" aria-live="polite" data-testid="readout">
        <p className="text-xs font-semibold text-ink-800">
          {fmtDate(cur.date)}
          {sel === points.length - 1 ? ' (latest)' : ''}
        </p>
        <dl className="mt-1 grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt style={{ color: COLORS.spent }}>Spent</dt>
            <dd className="font-semibold text-ink-900">{fmtMoney(cur.spent)}</dd>
          </div>
          <div>
            <dt style={{ color: COLORS.received }}>Received</dt>
            <dd className="font-semibold text-ink-900">{fmtMoney(cur.received)}</dd>
          </div>
          <div>
            <dt style={{ color: COLORS.net }}>Net</dt>
            <dd className={`font-semibold ${cur.net < 0 ? 'text-status-blocked' : 'text-ink-900'}`}>{fmtMoney(cur.net)}</dd>
          </div>
        </dl>
        <p className="mt-1 text-xs text-ink-400">Tap or drag across the graph to read another date.</p>
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: COLORS[s.key] }} />
            {s.key === 'net' ? 'Net (received − spent)' : s.name}
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

// Every date with the running totals, for reading or checking exact numbers.
export function FiguresTable({ points }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">Running totals by date</caption>
        <thead>
          <tr className="border-b border-ink-100 text-left text-ink-600">
            <th className="py-1.5 pr-2 font-medium">Date</th>
            <th className="py-1.5 pr-2 text-right font-medium">Spent</th>
            <th className="py-1.5 pr-2 text-right font-medium">Received</th>
            <th className="py-1.5 text-right font-medium">Net</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date} className="border-b border-ink-50">
              <td className="py-1.5 pr-2 text-ink-800">{fmtDate(p.date)}</td>
              <td className="py-1.5 pr-2 text-right text-ink-900">{fmtMoney(p.spent)}</td>
              <td className="py-1.5 pr-2 text-right text-ink-900">{fmtMoney(p.received)}</td>
              <td className={`py-1.5 text-right ${p.net < 0 ? 'text-status-blocked' : 'text-ink-900'}`}>{fmtMoney(p.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
