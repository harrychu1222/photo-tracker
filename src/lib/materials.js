import { dayDiff, todayLocal } from './tasks'
import { fmtDate } from './format'

// Material status: To order -> Ordered -> Delivered.
export const MATERIAL_STATUSES = [
  { value: 'to_order', label: 'To order', color: '#8598A6' },
  { value: 'ordered', label: 'Ordered', color: '#D98E1F' },
  { value: 'delivered', label: 'Delivered', color: '#3E8E5D' }
]

export function materialStatusMeta(value) {
  return MATERIAL_STATUSES.find((s) => s.value === value) ?? MATERIAL_STATUSES[0]
}

// Tapping the chip moves to the next status, and from Delivered back round to To order.
export function nextMaterialStatus(value) {
  const i = MATERIAL_STATUSES.findIndex((s) => s.value === (value || 'to_order'))
  return MATERIAL_STATUSES[(i + 1) % MATERIAL_STATUSES.length].value
}

// Fields to save when a material changes status, with the dates filled in (device-local
// today, so an evening update in Australia is not stamped as tomorrow or yesterday).
export function materialStatusPatch(material, status, today = todayLocal()) {
  if (status === 'to_order') return { status, ordered_on: null, delivered_on: null }
  if (status === 'ordered') return { status, ordered_on: material.ordered_on || today, delivered_on: null }
  return { status, ordered_on: material.ordered_on || today, delivered_on: today }
}

// How many of a task's materials are in each state.
export function materialProgress(materials) {
  const out = { total: materials.length, toOrder: 0, ordered: 0, delivered: 0 }
  materials.forEach((m) => {
    const s = m.status || 'to_order'
    if (s === 'delivered') out.delivered += 1
    else if (s === 'ordered') out.ordered += 1
    else out.toOrder += 1
  })
  return out
}

// Whole days an undelivered material is past its expected delivery date, or null.
export function materialLateDays(material, today = todayLocal()) {
  if ((material.status || 'to_order') === 'delivered' || !material.expected_on) return null
  const d = dayDiff(material.expected_on, today)
  return d > 0 ? d : null
}

// What to save when someone edits the dates by hand. Keeps the status in step: a delivered
// date means Delivered, an ordered date alone means Ordered, no dates means To order.
// Pass only the fields being changed ('' or null clears one).
export function materialDatePatch(material, changes) {
  const val = (k) => {
    const v = k in changes ? changes[k] : material[k]
    return v || null
  }
  const ordered_on = val('ordered_on')
  const delivered_on = val('delivered_on')
  const expected_on = val('expected_on')
  let status = material.status || 'to_order'
  if (delivered_on) status = 'delivered'
  else if (ordered_on) status = 'ordered'
  else status = 'to_order'
  return { status, ordered_on, delivered_on, expected_on }
}

// One line of dates for a material: "Ordered 22 Oct 2026 · Expected 28 Oct 2026".
export function materialDatesText(material) {
  const bits = []
  if (material.ordered_on) bits.push(`Ordered ${fmtDate(material.ordered_on)}`)
  if (material.delivered_on) bits.push(`Delivered ${fmtDate(material.delivered_on)}`)
  else if (material.expected_on) bits.push(`Expected ${fmtDate(material.expected_on)}`)
  return bits.join(' · ')
}

// A warning on a task whose materials may not be there in time. Two cases: a delivery is
// expected after the task starts, or the task starts within a week (or already should have)
// with materials still not delivered.
export function materialWarning(task, materials, today = todayLocal()) {
  if (task.status === 'done' || !task.planned_start) return null
  const missing = materials.filter((m) => (m.status || 'to_order') !== 'delivered')
  if (!missing.length) return null

  const late = missing.filter((m) => m.expected_on && m.expected_on > task.planned_start)
  if (late.length) {
    const latest = late.reduce((a, m) => (m.expected_on > a ? m.expected_on : a), late[0].expected_on)
    return `${late.length} material${late.length === 1 ? '' : 's'} expected ${fmtDate(latest)}, after the task starts on ${fmtDate(task.planned_start)}`
  }

  const days = dayDiff(today, task.planned_start)
  if (days > 7) return null
  const things = `${missing.length} material${missing.length === 1 ? '' : 's'} not delivered`
  if (days < 0) return `${things}, planned start has passed`
  if (days === 0) return `${things}, starts today`
  return `${things}, starts in ${days} day${days === 1 ? '' : 's'}`
}

// Quantity from a measurement plus a waste allowance, e.g. 14.5 m2 + 10% = 15.95.
export function measurementQty(value, wastePct = 0) {
  const w = Number(wastePct) || 0
  return Math.round(Number(value) * (1 + w / 100) * 1000) / 1000
}
