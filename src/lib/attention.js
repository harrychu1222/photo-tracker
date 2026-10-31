// What needs the builder's eye on the project Overview: late tasks, blocked tasks, late
// deliveries and spending that is running ahead of the work done.
import { dayDiff, scheduleNote, todayLocal } from './tasks'
import { materialLateDays } from './materials'
import { fmtDate } from './format'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// How far behind the plan the project is: the longest overdue open task, in days.
export function scheduleSummary(tasks, today = todayLocal()) {
  let behindDays = 0
  let overdueCount = 0
  tasks.forEach((t) => {
    if (t.status === 'done' || t.actual_end) return
    const note = scheduleNote(t, today)
    if (!note || note.tone !== 'bad') return
    overdueCount += 1
    const since = t.planned_end && t.planned_end < today ? t.planned_end : t.planned_start
    if (since) behindDays = Math.max(behindDays, dayDiff(since, today))
  })
  return { behindDays, overdueCount }
}

// `go` says where a click should take the person: a top tab and, for Plan/Money, a sub tab.
export function attentionItems({ tasks, materials, money, progress, isAdmin, today = todayLocal(), limit = 3 }) {
  const items = []

  const late = tasks
    .filter((t) => t.status !== 'done' && !t.actual_end)
    .map((t) => ({ t, note: scheduleNote(t, today) }))
    .filter((x) => x.note && x.note.tone === 'bad')
    .sort((a, b) => (a.t.planned_end || a.t.planned_start || '').localeCompare(b.t.planned_end || b.t.planned_start || ''))
  late.slice(0, limit).forEach(({ t, note }) =>
    items.push({ id: `late-${t.id}`, tone: 'bad', title: `${t.name} is behind`, detail: note.text, go: { tab: 'plan', sub: 'tasks' } })
  )
  if (late.length > limit) {
    items.push({ id: 'late-more', tone: 'bad', title: `${plural(late.length - limit, 'more task')} behind plan`, detail: 'See the task list', go: { tab: 'plan', sub: 'tasks' } })
  }

  tasks
    .filter((t) => t.status === 'blocked')
    .slice(0, limit)
    .forEach((t) => items.push({ id: `blocked-${t.id}`, tone: 'warn', title: `${t.name} is blocked`, detail: 'Marked as blocked', go: { tab: 'plan', sub: 'tasks' } }))

  const lateMaterials = materials
    .map((m) => ({ m, days: materialLateDays(m, today) }))
    .filter((x) => x.days != null)
    .sort((a, b) => b.days - a.days)
  lateMaterials.slice(0, limit).forEach(({ m, days }) =>
    items.push({
      id: `mat-${m.id}`,
      tone: 'warn',
      title: `${m.name} not delivered`,
      detail: `Expected ${fmtDate(m.expected_on)}, ${plural(days, 'day')} late`,
      go: { tab: 'materials' }
    })
  )
  if (lateMaterials.length > limit) {
    items.push({ id: 'mat-more', tone: 'warn', title: `${plural(lateMaterials.length - limit, 'more delivery', )} late`, detail: 'See Materials', go: { tab: 'materials' } })
  }

  if (isAdmin && money && money.target > 0 && money.actual > 0 && progress.total > 0) {
    const spent = Math.round((money.actual / money.target) * 100)
    if (spent >= progress.percent + 10) {
      items.push({
        id: 'spend',
        tone: 'warn',
        title: 'Spending is ahead of progress',
        detail: `${spent}% of target spent, ${progress.percent}% done`,
        go: { tab: 'money', sub: 'expenses' }
      })
    }
  }
  return items
}
