// Helpers for the project form: filling the quote estimates and the actual dates from the task plan.
import { sumCosts, taskCost } from './costs'

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

// The average of every usual hourly rate that has been set (null when none).
export function averageRate(book) {
  const rates = [...Object.values(book?.user || {}), ...Object.values(book?.worker || {})].map(Number).filter((r) => r > 0)
  return rates.length ? round2(rates.reduce((s, r) => s + r, 0) / rates.length) : null
}

// Estimates taken from the plan on the tasks: planned materials, planned equipment, and
// planned hours x the average usual rate. Labour is null when no rate has been set yet.
export function estimatesFromPlan(tasks, materialsByTask, equipmentByTask, matPrices, eqPrices, book) {
  const total = sumCosts(tasks.map((t) => taskCost(materialsByTask[t.id] || [], equipmentByTask[t.id] || [], matPrices, eqPrices)))
  const hours = round2(tasks.reduce((s, t) => s + Number(t.planned_hours || 0), 0))
  const rate = averageRate(book)
  return {
    materials: round2(total.materials || 0),
    equipment: round2(total.equipment || 0),
    labour: rate != null && hours > 0 ? round2(hours * rate) : null,
    hours,
    rate
  }
}

// Earliest planned start and latest planned end across tasks (nulls when no task has dates).
export function taskPlannedSpan(tasks) {
  const starts = tasks.map((t) => t.planned_start).filter(Boolean).sort()
  const ends = tasks.map((t) => t.planned_end).filter(Boolean).sort()
  return { start: starts[0] || null, end: ends.length ? ends[ends.length - 1] : null }
}

// The project's actual start/end: what was typed in, otherwise worked out from the tasks
// (start = first task started; end = last task finished, only once the project is Complete).
export function actualSpan(project, tasks) {
  const starts = tasks.map((t) => t.actual_start).filter(Boolean).sort()
  const ends = tasks.map((t) => t.actual_end).filter(Boolean).sort()
  return {
    start: project?.actual_start || starts[0] || null,
    end: project?.actual_end || (project?.status === 'complete' && ends.length ? ends[ends.length - 1] : null),
    derivedStart: !project?.actual_start && !!starts[0],
    derivedEnd: !project?.actual_end && project?.status === 'complete' && ends.length > 0
  }
}
