import { dayDiff, todayLocal } from './tasks'

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

// A warning when a task is about to start (or should have) and some of its materials
// have not arrived yet. Looks one week ahead.
export function materialWarning(task, materials, today = todayLocal()) {
  if (task.status === 'done' || !task.planned_start) return null
  const missing = materials.filter((m) => (m.status || 'to_order') !== 'delivered').length
  if (!missing) return null
  const days = dayDiff(today, task.planned_start)
  if (days > 7) return null
  const things = `${missing} material${missing === 1 ? '' : 's'} not delivered`
  if (days < 0) return `${things}, planned start has passed`
  if (days === 0) return `${things}, starts today`
  return `${things}, starts in ${days} day${days === 1 ? '' : 's'}`
}

// Quantity from a measurement plus a waste allowance, e.g. 14.5 m2 + 10% = 15.95.
export function measurementQty(value, wastePct = 0) {
  const w = Number(wastePct) || 0
  return Math.round(Number(value) * (1 + w / 100) * 1000) / 1000
}
