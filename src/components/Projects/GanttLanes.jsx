import { dayNumber } from '../../lib/cashflow'
import { dayDiff } from '../../lib/tasks'
import { addDays } from '../../lib/gantt'
import { fmtDate, fmtMoney } from '../../lib/format'

// Monday of the week a date falls in.
function weekStart(date) {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return addDays(date, -((dow + 6) % 7))
}

// Extra rows under the task bars, on the same date axis: deliveries, hours logged, cash flow.
export default function GanttLanes({ range, dw, nameW, timeW, today, materials, time, cash, show }) {
  const off = (d) => dayDiff(range.start, d)
  const label = 'sticky left-0 z-20 flex flex-col justify-center border-b border-r border-ink-200 bg-ink-50 px-2'

  // Deliveries: delivered on the delivered date, otherwise expected on the expected date.
  const marks = materials
    .map((m) => {
      const delivered = (m.status || 'to_order') === 'delivered'
      const date = delivered ? m.delivered_on : m.expected_on
      if (!date) return null
      const day = String(date).slice(0, 10)
      const late = !delivered && day < today
      return { id: m.id, name: m.name, day, color: delivered ? '#3E8E5D' : late ? '#C0503E' : '#D98E1F', late, delivered }
    })
    .filter(Boolean)
    .sort((a, b) => a.day.localeCompare(b.day))

  // Hours logged per week.
  const weeks = {}
  time.forEach((e) => {
    const w = weekStart(String(e.work_date).slice(0, 10))
    weeks[w] = (weeks[w] || 0) + Number(e.hours || 0)
  })
  const weekList = Object.entries(weeks).sort((a, b) => a[0].localeCompare(b[0]))
  const maxHours = Math.max(1, ...weekList.map(([, h]) => h))

  const CH = 96
  const startDay = dayNumber(range.start)
  const maxCash = cash ? Math.max(1, ...cash.points.map((p) => Math.max(p.spent, p.received)), cash.quote || 0) : 1
  const cx = (p) => (p.day - startDay + 0.5) * dw
  const cy = (v) => CH - 8 - (v / maxCash) * (CH - 20)
  const path = (key) => cash.points.map((p, i) => `${i ? 'L' : 'M'}${cx(p).toFixed(1)},${cy(p[key]).toFixed(1)}`).join(' ')
  const lastPoint = cash?.points[cash.points.length - 1]
  const ticks = [0, maxCash / 2, maxCash]
  const short = (v) => (v >= 1000 ? `$${Math.round(v / 100) / 10}k` : `$${Math.round(v)}`)

  return (
    <div data-testid="gantt-lanes">
      {show.deliveries && (
        <div className="flex border-t-[6px] border-ink-200" style={{ height: 66 }} data-testid="lane-deliveries">
          <div className={label} style={{ width: nameW, minWidth: nameW }}>
            <span className="text-xs font-semibold text-ink-900">Deliveries</span>
            <span className="text-[10px] text-ink-600">Expected and arrived</span>
          </div>
          <div className="relative border-b border-ink-200" style={{ width: timeW }}>
            {marks.length === 0 && <span className="absolute left-2 top-4 text-[11px] text-ink-400">No expected delivery dates yet</span>}
            {marks.map((m, i) => (
              <div key={m.id} data-testid={`delivery-${m.id}`} className="absolute" style={{ left: (off(m.day) + 0.5) * dw, top: i % 2 ? 32 : 6 }}>
                <span className="block h-3 w-3 -translate-x-1/2 rotate-45 rounded-[3px]" style={{ backgroundColor: m.color }} />
                <span className="absolute left-2 top-0 whitespace-nowrap text-[10px] font-semibold" style={{ color: m.late ? '#7A2A1D' : '#2B3947' }}>
                  {m.name}{m.late ? ' (late)' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {show.hours && (
        <div className="flex border-t-[6px] border-ink-200" style={{ height: 70 }} data-testid="lane-hours">
          <div className={label} style={{ width: nameW, minWidth: nameW }}>
            <span className="text-xs font-semibold text-ink-900">Hours logged</span>
            <span className="text-[10px] text-ink-600">Per week</span>
          </div>
          <div className="relative border-b border-ink-200" style={{ width: timeW }}>
            {weekList.length === 0 && <span className="absolute left-2 top-5 text-[11px] text-ink-400">No hours logged yet</span>}
            {weekList.map(([w, h]) => (
              <div
                key={w}
                data-testid={`hours-${w}`}
                className="absolute bottom-0 rounded-t bg-[#9DB6D6]"
                style={{ left: Math.max(0, off(w)) * dw + 1, width: Math.max(7 * dw - 2, 14), height: Math.max(4, (h / maxHours) * 44) }}
                title={`Week of ${fmtDate(w)}: ${Number(h.toFixed(2))} h`}
              >
                <span className="absolute -top-4 left-0 whitespace-nowrap text-[10px] font-semibold text-ink-800">{Number(h.toFixed(1))} h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {show.cash && cash && (
        <div className="flex border-t-[6px] border-ink-200" style={{ height: CH + 30 }} data-testid="lane-cash">
          <div className={label} style={{ width: nameW, minWidth: nameW }}>
            <span className="text-xs font-semibold text-ink-900">Cash flow</span>
            <span className="mt-1 text-[10px] font-semibold text-[#7A4B05]">Spent {short(lastPoint.spent)}</span>
            <span className="text-[10px] font-semibold text-ink-900">Received {short(lastPoint.received)}</span>
            {ticks.map((v) => (
              <span key={v} className="absolute right-1.5 text-[10px] tabular-nums text-ink-600" style={{ top: cy(v) - 6 }} data-testid={`axis-${Math.round(v)}`}>
                {short(v)}
              </span>
            ))}
          </div>
          <div className="relative border-b border-ink-200" style={{ width: timeW }}>
            <svg width={timeW} height={CH + 24} role="img" aria-label={`Cash flow: spent ${Math.round(lastPoint.spent)}, received ${Math.round(lastPoint.received)}`}>
              {ticks.map((v) => (
                <line key={v} x1="0" x2={timeW} y1={cy(v)} y2={cy(v)} stroke="#D5DEE3" strokeDasharray={v === 0 ? undefined : '3 4'} />
              ))}
              {cash.quote != null && <line x1="0" x2={timeW} y1={cy(cash.quote)} y2={cy(cash.quote)} stroke="#8598A6" strokeDasharray="4 4" />}
              <path d={path('spent')} fill="none" stroke="#D98E1F" strokeWidth="2.5" strokeLinejoin="round" />
              <path d={path('received')} fill="none" stroke="#1F2A37" strokeWidth="2.5" strokeLinejoin="round" />
              {cash.quote != null && (
                <text x={timeW - 4} y={cy(cash.quote) - 4} textAnchor="end" fontSize="10" fill="#4B5C6B">Quote {fmtMoney(cash.quote)}</text>
              )}
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}
