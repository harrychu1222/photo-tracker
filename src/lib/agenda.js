// Phone agenda: what is due, grouped by day. Open tasks are due on their planned end date
// (or start date when there is no end), and undelivered materials on their expected date.
import { plannedSpan } from './gantt'

export function buildAgenda(tasks, materials, today) {
  const items = []
  tasks.forEach((t) => {
    if (t.status === 'done') return
    const s = plannedSpan(t)
    if (s) items.push({ kind: 'task', id: `t-${t.id}`, date: s.end, task: t })
  })
  materials.forEach((m) => {
    if ((m.status || 'to_order') === 'delivered' || !m.expected_on) return
    items.push({ kind: 'delivery', id: `m-${m.id}`, date: String(m.expected_on).slice(0, 10), material: m })
  })
  items.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind))
  const days = []
  items.forEach((it) => {
    const overdue = it.date < today
    const key = overdue ? 'overdue' : it.date
    let day = days.find((d) => d.key === key)
    if (!day) days.push((day = { key, date: overdue ? null : it.date, overdue, isToday: it.date === today, items: [] }))
    day.items.push({ ...it, late: overdue })
  })
  return days
}
