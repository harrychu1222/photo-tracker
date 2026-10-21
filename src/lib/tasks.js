const pad = (n) => String(n).padStart(2, '0')

// Today's date as 'YYYY-MM-DD' in the device's own time zone (so "today" in Melbourne
// is Melbourne's today, not UTC's).
export function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function dayNumber(value) {
  const [y, m, d] = value.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86400000)
}

// Whole days from a to b ('YYYY-MM-DD'); negative if b is earlier.
export function dayDiff(a, b) {
  return dayNumber(b) - dayNumber(a)
}

// Length of a date range in days, counting both the first and last day.
export function daysBetween(start, end) {
  if (!start || !end) return null
  return dayDiff(start, end) + 1
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export function fmtDays(n) {
  return n == null ? '—' : plural(n, 'day')
}

export function fmtHours(value) {
  if (value == null || value === '') return '—'
  // Up to two decimals, no trailing zeros: 12 -> "12 h", 2.5 -> "2.5 h", 2.25 -> "2.25 h".
  return `${Number(Number(value).toFixed(2))} h`
}

// What changes when a task's status is switched, so dates and progress stay consistent
// without anyone having to remember to fill them in. Returns only the fields that change.
export function statusPatch(task, status) {
  const today = todayLocal()
  let pct = task.percent_complete ?? 0
  let start = task.actual_start || null
  let end = task.actual_end || null

  if (status === 'todo') {
    pct = 0
    start = null
    end = null
  } else if (status === 'in_progress') {
    start = start || today
    end = null
    pct = Math.min(pct, 99)
  } else if (status === 'done') {
    start = start || today
    end = end || today
    pct = 100
  } else if (status === 'blocked') {
    end = null
    pct = Math.min(pct, 99)
  }

  return { status, percent_complete: pct, actual_start: start, actual_end: end }
}

// A one-line "how is this tracking against plan" note, or null when there's nothing to say.
export function scheduleNote(task, today = todayLocal()) {
  if (task.status === 'done' || task.actual_end) {
    if (task.actual_end && task.planned_end) {
      const d = dayDiff(task.planned_end, task.actual_end)
      if (d > 0) return { text: `Finished ${plural(d, 'day')} late`, tone: 'bad' }
      if (d < 0) return { text: `Finished ${plural(-d, 'day')} early`, tone: 'good' }
      return { text: 'Finished on time', tone: 'good' }
    }
    return null
  }
  if (task.planned_end && task.planned_end < today) {
    return { text: `Overdue by ${plural(dayDiff(task.planned_end, today), 'day')}`, tone: 'bad' }
  }
  if (task.status === 'todo' && task.planned_start && task.planned_start < today) {
    return { text: `Should have started ${plural(dayDiff(task.planned_start, today), 'day')} ago`, tone: 'bad' }
  }
  return null
}

// Planned vs actual duration in days. Actual runs to today while the task is still open.
export function durations(task, today = todayLocal()) {
  const planned = daysBetween(task.planned_start, task.planned_end)
  let actual = null
  if (task.actual_start) {
    actual = daysBetween(task.actual_start, task.actual_end || (task.status === 'done' ? task.actual_start : today))
    if (actual != null && actual < 1) actual = 1
  }
  return { planned, actual, open: !!task.actual_start && !task.actual_end }
}

// Overall completion for a set of tasks: the average of each task's percent.
export function taskProgress(tasks) {
  if (!tasks.length) return { percent: 0, done: 0, total: 0 }
  const sum = tasks.reduce((acc, t) => acc + (t.percent_complete || 0), 0)
  return {
    percent: Math.round(sum / tasks.length),
    done: tasks.filter((t) => t.status === 'done').length,
    total: tasks.length
  }
}
