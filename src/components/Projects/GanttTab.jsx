import { useEffect, useMemo, useRef, useState } from 'react'
import { useWork } from '../../context/WorkContext'
import { statusMeta } from '../../statusConfig'
import { buildGantt, conflictsFor, plannedSpan } from '../../lib/gantt'
import { fmtDate, fmtDateRange } from '../../lib/format'
import { fmtHours, todayLocal } from '../../lib/tasks'
import { useAuth } from '../../context/AuthContext'
import { useMedia } from '../../hooks/useMedia'
import { buildCashFlow } from '../../lib/cashflow'
import { labourEvents } from '../../lib/labour'
import GanttLanes from './GanttLanes'
import AgendaView from './AgendaView'

const ROW_H = 34
const GROUP_H = 22
const HEAD_H = 40
const SCALES = [
  { id: 'days', label: 'Days', dw: 28 },
  { id: 'weeks', label: 'Weeks', dw: 12 },
  { id: 'months', label: 'Months', dw: 4 }
]

const chip = (on) =>
  `rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'}`

// View-only timeline of the project's tasks: planned bars, progress, actual dates, dependency arrows.
export default function GanttTab({ project }) {
  const { tasksByProject, roomsByProject, roomsById, tasksById, materialsByTask, expensesByProject, paymentsByProject, timeByProject, rateBook, lumpsByProject } = useWork()
  const { isAdmin } = useAuth()
  const isDesktop = useMedia('(min-width: 768px)')
  const NAME_W = isDesktop ? 220 : 112
  const [view, setView] = useState(null) // null = timeline on a computer, agenda on a phone
  const [lanes, setLanes] = useState({ deliveries: true, hours: true, cash: true })
  const tasks = tasksByProject[project.id] || []
  const rooms = roomsByProject[project.id] || []
  const today = todayLocal()
  const [roomFilter, setRoomFilter] = useState('all')
  const [hideDone, setHideDone] = useState(false)
  const [groupByRoom, setGroupByRoom] = useState(true)
  const [scaleId, setScaleId] = useState(null) // null = pick one that fits the project
  const [selected, setSelected] = useState(null)
  const scroller = useRef(null)

  const materials = useMemo(() => tasks.flatMap((t) => materialsByTask[t.id] || []), [tasks, materialsByTask])
  const time = timeByProject[project.id] || []
  const expenses = expensesByProject[project.id] || []
  const payments = paymentsByProject[project.id] || []
  const lumps = lumpsByProject[project.id] || []
  const showCash = isAdmin && lanes.cash
  const cash = useMemo(
    () => (showCash ? buildCashFlow(expenses, payments, { today, quote: null, labour: labourEvents(time, rateBook, lumps, today) }) : null),
    [showCash, expenses, payments, time, rateBook, lumps, today]
  )
  const extraDates = useMemo(
    () => [
      ...(lanes.deliveries ? materials.map((m) => ((m.status || 'to_order') === 'delivered' ? m.delivered_on : m.expected_on)) : []),
      ...(lanes.hours ? time.map((e) => e.work_date) : []),
      ...(cash ? [cash.points[0].date] : [])
    ].map((d) => (d ? String(d).slice(0, 10) : null)),
    [lanes, materials, time, cash]
  )
  const g = useMemo(() => buildGantt(tasks, rooms, { today, roomFilter, hideDone, groupByRoom, extraDates }), [tasks, rooms, today, roomFilter, hideDone, groupByRoom, extraDates])
  const activeView = view || (isDesktop ? 'timeline' : 'agenda')
  const autoScale = g.range.days <= 45 ? 'days' : g.range.days <= 200 ? 'weeks' : 'months'
  const scale = SCALES.find((s) => s.id === (scaleId || autoScale))
  const dw = scale.dw

  // Open scrolled to today.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = Math.max(0, g.todayOff * dw - 90)
  }, [dw, g.todayOff, activeView])

  if (tasks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">
        Add tasks with planned start and end dates on the Tasks tab, and they will appear here.
      </p>
    )
  }

  // Vertical position of each row, and the y of each task's bar centre (for the arrows).
  let y = 0
  const placed = g.rows.map((r) => {
    const h = r.type === 'group' ? GROUP_H : ROW_H
    const row = { ...r, y, h }
    y += h
    return row
  })
  const bodyH = y
  const centre = Object.fromEntries(placed.filter((r) => r.type === 'task').map((r) => [r.task.id, r.y + r.h / 2]))
  const barOf = Object.fromEntries(placed.filter((r) => r.type === 'task').map((r) => [r.task.id, r.bar]))
  const timeW = g.range.days * dw

  // Week lines on Mondays.
  const [ry, rm, rd] = g.range.start.split('-').map(Number)
  const startDow = new Date(Date.UTC(ry, rm - 1, rd)).getUTCDay() // 0 = Sunday
  const mondays = []
  for (let i = 0; i < g.range.days; i++) if ((startDow + i) % 7 === 1) mondays.push(i)
  const dayNum = (i) => new Date(Date.UTC(ry, rm - 1, rd + i)).getUTCDate()

  const sel = selected && tasksById[selected] ? tasksById[selected] : null
  const selBar = sel ? barOf[sel.id] : null
  const blockers = sel ? (sel.blocked_by_ids || []).map((id) => tasksById[id]?.name).filter(Boolean) : []
  const clashes = sel ? conflictsFor(sel.id, g.links, tasksById) : []

  return (
    <div>
      {!isDesktop && (
        <div role="group" aria-label="Schedule view" className="mb-3 flex gap-1 rounded-xl bg-ink-100 p-1">
          {[['agenda', 'Agenda'], ['timeline', 'Timeline']].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} aria-pressed={activeView === id} className={`min-h-[40px] flex-1 rounded-lg text-sm font-semibold ${activeView === id ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600'}`}>
              {label}
            </button>
          ))}
        </div>
      )}
      {activeView === 'agenda' && <AgendaView tasks={tasks} materials={materials} today={today} roomsById={roomsById} onOpenTask={(id) => { setView('timeline'); setSelected(id) }} />}
      {activeView === 'timeline' && (<>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {SCALES.map((s) => (
          <button key={s.id} onClick={() => setScaleId(s.id)} className={chip(scale.id === s.id)} aria-pressed={scale.id === s.id}>
            {s.label}
          </button>
        ))}
        <button onClick={() => setHideDone((v) => !v)} className={chip(hideDone)} aria-pressed={hideDone}>
          Hide done
        </button>
        <button onClick={() => setLanes((l) => ({ ...l, deliveries: !l.deliveries }))} className={chip(lanes.deliveries)} aria-pressed={lanes.deliveries}>
          Deliveries
        </button>
        <button onClick={() => setLanes((l) => ({ ...l, hours: !l.hours }))} className={chip(lanes.hours)} aria-pressed={lanes.hours}>
          Hours
        </button>
        {isAdmin && (
          <button onClick={() => setLanes((l) => ({ ...l, cash: !l.cash }))} className={chip(lanes.cash)} aria-pressed={lanes.cash}>
            Cash flow
          </button>
        )}
        {rooms.length > 0 && (
          <button onClick={() => setGroupByRoom((v) => !v)} className={chip(groupByRoom)} aria-pressed={groupByRoom}>
            Group by room
          </button>
        )}
      </div>
      {rooms.length > 0 && (
        <select
          value={roomFilter}
          onChange={(e) => setRoomFilter(e.target.value)}
          aria-label="Room"
          className="mb-3 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All rooms</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
          <option value="none">No room</option>
        </select>
      )}

      {g.scheduledCount === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-200 py-8 text-center text-sm text-ink-600">
          None of these tasks has planned dates yet. Set a planned start and end on a task to see it here.
        </p>
      ) : (
        <div ref={scroller} className="overflow-x-auto rounded-xl border border-ink-100 bg-white" data-testid="gantt-scroll">
          <div style={{ width: NAME_W + timeW, position: 'relative' }}>
            {/* header */}
            <div className="flex" style={{ height: HEAD_H }}>
              <div className="sticky left-0 z-20 border-b border-r border-ink-100 bg-ink-50" style={{ width: NAME_W, minWidth: NAME_W }} />
              <div className="relative border-b border-ink-100 bg-ink-50" style={{ width: timeW }}>
                {g.months.map((m) => (
                  <div
                    key={m.label}
                    className="absolute top-0 truncate border-r border-ink-100 px-1 text-[10px] font-semibold text-ink-800"
                    style={{ left: m.startOff * dw, width: m.len * dw, height: 18 }}
                  >
                    {m.label}
                  </div>
                ))}
                {mondays.map((i) =>
                  dw >= 10 ? (
                    <span key={i} className="absolute text-[9px] text-ink-600" style={{ left: i * dw + 2, top: 22 }}>
                      {dayNum(i)}
                    </span>
                  ) : null
                )}
              </div>
            </div>

            {/* body */}
            <div className="relative" style={{ height: bodyH }}>
              {/* names (sticky column) */}
              <div className="sticky left-0 z-20 float-left bg-white" style={{ width: NAME_W }}>
                {placed.map((r) =>
                  r.type === 'group' ? (
                    <div key={`g-${r.title}`} className="truncate border-b border-r border-ink-100 bg-ink-50 px-2 text-[10px] font-semibold uppercase tracking-wide text-ink-600" style={{ height: r.h, lineHeight: `${r.h}px` }}>
                      {r.title}
                    </div>
                  ) : (
                    <button
                      key={r.task.id}
                      onClick={() => setSelected(r.task.id)}
                      className={`block w-full truncate border-b border-r border-ink-100 px-2 text-left text-xs ${selected === r.task.id ? 'bg-signal-100 font-semibold text-ink-900' : 'text-ink-800'}`}
                      style={{ height: r.h }}
                      aria-label={`Task ${r.task.name}`}
                    >
                      {r.task.name}
                    </button>
                  )
                )}
              </div>

              {/* timeline */}
              <div className="absolute top-0" style={{ left: NAME_W, width: timeW, height: bodyH }}>
                {mondays.map((i) => (
                  <div key={i} className="absolute top-0 border-l border-ink-100" style={{ left: i * dw, height: bodyH }} />
                ))}
                {placed.map((r) => (
                  <div key={r.type === 'group' ? `bg-${r.title}` : `bg-${r.task.id}`} className={`absolute left-0 right-0 border-b border-ink-100 ${r.type === 'group' ? 'bg-ink-50/70' : ''}`} style={{ top: r.y, height: r.h }} />
                ))}

                {g.todayOff >= 0 && g.todayOff < g.range.days && (
                  <div className="absolute top-0 z-10 border-l-2 border-status-blocked/70" style={{ left: (g.todayOff + 0.5) * dw, height: bodyH }} title={`Today, ${fmtDate(today)}`} data-testid="gantt-today" />
                )}

                {placed
                  .filter((r) => r.type === 'task')
                  .map((r) => {
                    const b = r.bar
                    const color = statusMeta(r.task.status).color
                    return (
                      <div key={r.task.id}>
                        <button
                          onClick={() => setSelected(r.task.id)}
                          aria-label={`Bar ${r.task.name}, ${fmtDateRange(b.start, b.end)}, ${b.progress}% done`}
                          data-testid={`bar-${r.task.id}`}
                          className="absolute z-10 overflow-hidden rounded"
                          style={{
                            left: b.startOff * dw,
                            width: Math.max(b.len * dw, 6),
                            top: r.y + 7,
                            height: 16,
                            backgroundColor: `${color}40`,
                            outline: b.late ? '2px solid #C0503E' : selected === r.task.id ? '2px solid #1f2937' : 'none'
                          }}
                        >
                          <span className="absolute inset-y-0 left-0" style={{ width: `${b.progress}%`, backgroundColor: color }} />
                          {b.len * dw > 52 && (
                            <span className="relative px-1 text-[10px] font-medium leading-4 text-ink-900">{b.progress > 0 ? `${b.progress}%` : ''}</span>
                          )}
                        </button>
                        {b.actual && (
                          <div
                            className="absolute z-10 rounded-full bg-ink-800"
                            title="Actual"
                            data-testid={`actual-${r.task.id}`}
                            style={{ left: b.actual.startOff * dw, width: Math.max(b.actual.len * dw, 4), top: r.y + 26, height: 4, opacity: b.actual.open ? 0.55 : 1 }}
                          />
                        )}
                      </div>
                    )
                  })}

                <svg className="pointer-events-none absolute left-0 top-0 z-[5]" width={timeW} height={bodyH} aria-hidden="true">
                  <defs>
                    <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <path d="M0,0 L6,3 L0,6 z" fill="#64748b" />
                    </marker>
                    <marker id="arrow-bad" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <path d="M0,0 L6,3 L0,6 z" fill="#C0503E" />
                    </marker>
                  </defs>
                  {g.links.map((l) => {
                    const a = barOf[l.from]
                    const b = barOf[l.to]
                    const x1 = (a.startOff + a.len) * dw
                    const x2 = b.startOff * dw
                    const y1 = centre[l.from] - 1
                    const y2 = centre[l.to] - 1
                    const mid = Math.max(x1 + 6, x2 - 6)
                    return (
                      <path
                        key={`${l.from}-${l.to}`}
                        data-testid={`link-${l.from}-${l.to}`}
                        d={`M${x1},${y1} H${x1 + 4} V${(y1 + y2) / 2} H${mid} V${y2} H${x2}`}
                        fill="none"
                        stroke={l.conflict ? '#C0503E' : '#64748b'}
                        strokeWidth="1.25"
                        strokeDasharray={l.conflict ? '3 2' : undefined}
                        markerEnd={`url(#${l.conflict ? 'arrow-bad' : 'arrow'})`}
                      />
                    )
                  })}
                </svg>
              </div>
            </div>
            <GanttLanes range={g.range} dw={dw} nameW={NAME_W} timeW={timeW} today={today} materials={materials} time={time} cash={cash} show={{ deliveries: lanes.deliveries, hours: lanes.hours, cash: showCash }} />
          </div>
        </div>
      )}

      {g.scheduledCount > 0 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded" style={{ background: 'linear-gradient(90deg,#D98E1F 50%,#D98E1F40 50%)' }} /> Planned, shaded = % done
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-1 w-5 rounded-full bg-ink-800" /> Actual
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded border-2 border-status-blocked" /> Past its end date, not done
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-5 border-t-2 border-dashed border-status-blocked" /> Starts before its blocker finishes
          </li>
        </ul>
      )}

      {sel && (
        <div className="mt-3 rounded-xl border border-ink-100 bg-ink-50 p-3 text-sm" data-testid="gantt-detail">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-ink-900">{sel.name}</p>
            <button onClick={() => setSelected(null)} className="text-xs font-medium text-ink-600" aria-label="Close details">
              Close
            </button>
          </div>
          <p className="mt-0.5 text-xs text-ink-600">
            {[roomsById[sel.room_id]?.name, statusMeta(sel.status).label, `${sel.percent_complete || 0}% done`, sel.planned_hours != null ? `${fmtHours(sel.planned_hours)} planned` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <dl className="mt-2 space-y-0.5 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-600">Planned</dt>
              <dd className="text-ink-900">{plannedSpan(sel) ? fmtDateRange(plannedSpan(sel).start, plannedSpan(sel).end) : 'No dates'}</dd>
            </div>
            {(sel.actual_start || sel.actual_end) && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-600">Actual</dt>
                <dd className="text-ink-900">
                  {sel.actual_start ? fmtDate(sel.actual_start) : '—'} – {sel.actual_end ? fmtDate(sel.actual_end) : 'in progress'}
                </dd>
              </div>
            )}
            {blockers.length > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-600">Waiting on</dt>
                <dd className="text-right text-ink-900">{blockers.join(', ')}</dd>
              </div>
            )}
          </dl>
          {selBar?.late && <p className="mt-1.5 text-xs font-medium text-status-blocked">Planned to finish {fmtDate(selBar.end)}, not done yet.</p>}
          {clashes.length > 0 && (
            <p className="mt-1 text-xs font-medium text-status-blocked">
              Planned to start before {clashes.join(', ')} {clashes.length === 1 ? 'finishes' : 'finish'}.
            </p>
          )}
        </div>
      )}

      {g.unscheduled.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-semibold text-ink-800">No planned dates yet ({g.unscheduled.length})</p>
          <ul className="space-y-0.5 text-xs text-ink-600">
            {g.unscheduled.map((t) => (
              <li key={t.id}>
                {roomsById[t.room_id] ? `${roomsById[t.room_id].name} — ` : ''}
                {t.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      </>)}
    </div>
  )
}
