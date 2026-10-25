// Gantt chart data: turns tasks into bars on a day grid. No drawing here, only numbers.
import { dayDiff } from './tasks'

const pad = (n) => String(n).padStart(2, '0')

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// A task is scheduled when it has at least one planned date. A single date makes a one-day bar.
export function plannedSpan(task) {
  const a = task.planned_start || task.planned_end
  const b = task.planned_end || task.planned_start
  if (!a) return null
  return b < a ? { start: b, end: a } : { start: a, end: b }
}

// tasks: the project's tasks (with blocked_by_ids). rooms: the project's rooms in display order.
// opts: { today, roomFilter: 'all' | 'none' | room id, hideDone, groupByRoom }
export function buildGantt(tasks, rooms, opts) {
  const { today, roomFilter = 'all', hideDone = false, groupByRoom = true } = opts
  const roomIds = new Set(rooms.map((r) => r.id))
  const visible = tasks.filter((t) => {
    if (hideDone && t.status === 'done') return false
    if (roomFilter === 'none') return !t.room_id || !roomIds.has(t.room_id)
    if (roomFilter !== 'all') return t.room_id === roomFilter
    return true
  })
  const scheduled = visible.filter((t) => plannedSpan(t))
  const unscheduled = visible.filter((t) => !plannedSpan(t))

  // Time range: everything planned or actually done, plus today, with a little padding.
  const dates = [today]
  scheduled.forEach((t) => {
    const s = plannedSpan(t)
    dates.push(s.start, s.end)
  })
  visible.forEach((t) => {
    if (t.actual_start) dates.push(t.actual_start)
    if (t.actual_end) dates.push(t.actual_end)
  })
  const first = dates.reduce((a, b) => (b < a ? b : a))
  const last = dates.reduce((a, b) => (b > a ? b : a))
  const range = { start: addDays(first, -2), end: addDays(last, 5) }
  range.days = dayDiff(range.start, range.end) + 1
  const off = (d) => dayDiff(range.start, d)

  const barOf = (t) => {
    const s = plannedSpan(t)
    if (!s) return null
    let actual = null
    if (t.actual_start) {
      const end = t.actual_end || (t.status === 'done' ? t.actual_start : today)
      actual = { startOff: off(t.actual_start), len: Math.max(1, dayDiff(t.actual_start, end < t.actual_start ? t.actual_start : end) + 1), open: !t.actual_end && t.status !== 'done' }
    }
    return {
      id: t.id,
      start: s.start,
      end: s.end,
      startOff: off(s.start),
      len: dayDiff(s.start, s.end) + 1,
      progress: Math.max(0, Math.min(100, Number(t.percent_complete) || 0)),
      status: t.status,
      late: s.end < today && t.status !== 'done',
      actual
    }
  }

  const byStart = (a, b) => {
    const as = plannedSpan(a)?.start || '9999-12-31'
    const bs = plannedSpan(b)?.start || '9999-12-31'
    return as < bs ? -1 : as > bs ? 1 : (a.sort_order || 0) - (b.sort_order || 0)
  }

  const rows = []
  const addTasks = (list) => list.sort(byStart).forEach((t) => rows.push({ type: 'task', task: t, bar: barOf(t) }))
  if (groupByRoom && rooms.length > 0) {
    rooms.forEach((r) => {
      const list = scheduled.filter((t) => t.room_id === r.id)
      if (list.length) {
        rows.push({ type: 'group', title: r.name })
        addTasks(list)
      }
    })
    const loose = scheduled.filter((t) => !t.room_id || !roomIds.has(t.room_id))
    if (loose.length) {
      rows.push({ type: 'group', title: 'No room' })
      addTasks(loose)
    }
  } else {
    addTasks([...scheduled])
  }

  // Dependency arrows between scheduled tasks. `conflict` = the task is planned to start before
  // (or on the day) its blocker is planned to finish.
  const barById = Object.fromEntries(rows.filter((r) => r.type === 'task').map((r) => [r.task.id, r.bar]))
  const links = []
  scheduled.forEach((t) => {
    ;(t.blocked_by_ids || []).forEach((bid) => {
      const from = barById[bid]
      const to = barById[t.id]
      if (from && to) links.push({ from: bid, to: t.id, conflict: to.start <= from.end })
    })
  })

  // Month bands for the header.
  const months = []
  let cursor = range.start
  while (cursor <= range.end) {
    const [y, m] = cursor.split('-').map(Number)
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`
    const stop = next > addDays(range.end, 1) ? addDays(range.end, 1) : next
    months.push({ label: `${MONTHS[m - 1]} ${y}`, startOff: off(cursor), len: dayDiff(cursor, stop) })
    cursor = next
  }

  return { range, rows, unscheduled, links, months, todayOff: off(today), scheduledCount: scheduled.length }
}

// Sentence for the detail panel.
export function conflictsFor(taskId, links, tasksById) {
  return links
    .filter((l) => l.to === taskId && l.conflict)
    .map((l) => tasksById[l.from]?.name)
    .filter(Boolean)
}
