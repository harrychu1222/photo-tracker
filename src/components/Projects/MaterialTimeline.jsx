import { useEffect, useRef } from 'react'
import GanttLanes from './GanttLanes'
import { useWork } from '../../context/WorkContext'
import { addDays } from '../../lib/gantt'
import { dayDiff, todayLocal } from '../../lib/tasks'

const DW = 18
const NAME_W = 96

// When each material is expected or arrived, on a date axis (the same lane the Gantt shows).
export default function MaterialTimeline({ project }) {
  const { tasksByProject, materialsByTask, materials } = useWork()
  const scroller = useRef(null)
  const today = todayLocal()
  const mats = [
    ...(tasksByProject[project.id] || []).flatMap((t) => materialsByTask[t.id] || []),
    ...materials.filter((m) => !m.task_id && m.project_id === project.id)
  ]
  const dates = mats.map((m) => String((m.status || 'to_order') === 'delivered' ? m.delivered_on || '' : m.expected_on || '').slice(0, 10)).filter(Boolean)
  const first = [today, ...dates].reduce((a, b) => (b < a ? b : a))
  const last = [today, ...dates].reduce((a, b) => (b > a ? b : a))
  const start = addDays(first, -3)
  const days = dayDiff(start, addDays(last, 6)) + 1
  const timeW = days * DW
  const todayOff = dayDiff(start, today)

  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = Math.max(0, todayOff * DW - 100)
  }, [todayOff])

  if (dates.length === 0) {
    return (
      <p className="mb-4 rounded-xl border border-dashed border-ink-200 bg-white py-5 text-center text-sm text-ink-600" data-testid="material-timeline-empty">
        Add an expected delivery date to a material and it will show on a timeline here.
      </p>
    )
  }

  // Week markers (Mondays) for the header.
  const [y, m, d] = start.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const mondays = []
  for (let i = 0; i < days; i++) if ((dow + i) % 7 === 1) mondays.push(i)

  return (
    <section className="mb-4 rounded-xl border border-ink-200 bg-white" aria-label="Delivery timeline" data-testid="material-timeline">
      <h3 className="px-3 pt-3 text-xs font-bold uppercase tracking-[0.08em] text-ink-600">Delivery timeline</h3>
      <div ref={scroller} className="mt-2 overflow-x-auto">
        <div style={{ width: NAME_W + timeW }} className="relative">
          <div className="flex h-7 border-y border-ink-200 bg-ink-50 text-[10px] text-ink-600">
            <div className="sticky left-0 z-20 border-r border-ink-200 bg-ink-50" style={{ width: NAME_W, minWidth: NAME_W }} />
            <div className="relative" style={{ width: timeW }}>
              {mondays.map((i) => (
                <span key={i} className="absolute top-1.5 border-l border-ink-200 pl-1" style={{ left: i * DW }}>
                  {new Date(Date.UTC(y, m - 1, d + i)).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                </span>
              ))}
            </div>
          </div>
          <div className="absolute top-7 z-10 w-0.5 bg-status-blocked/70" style={{ left: NAME_W + (todayOff + 0.5) * DW, bottom: 0 }} aria-hidden="true" />
          <GanttLanes range={{ start, days }} dw={DW} nameW={NAME_W} timeW={timeW} today={today} materials={mats} time={[]} cash={null} show={{ deliveries: true, hours: false, cash: false }} />
        </div>
      </div>
    </section>
  )
}
