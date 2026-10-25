// Hours worked and labour cost.
// Hours come from time_entries (crew see their own); money comes from admin-only tables:
//   person rates (per account holder), worker rates (people without a login),
//   entry rates (a one-off rate for a single entry) and lump sums (often subcontracted work).
// A "rate book" bundles the three rate lookups: { user: {id: rate}, worker: {id: rate}, entry: {id: rate} }.

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

export const emptyRateBook = () => ({ user: {}, worker: {}, entry: {} })

export const sumHours = (entries) => round2(entries.reduce((s, e) => s + Number(e.hours || 0), 0))

// task id -> hours logged against it
export function hoursByTask(entries) {
  const map = {}
  entries.forEach((e) => {
    if (e.task_id) map[e.task_id] = round2((map[e.task_id] || 0) + Number(e.hours || 0))
  })
  return map
}

export function sortTime(entries) {
  return [...entries].sort(
    (a, b) =>
      String(b.work_date).localeCompare(String(a.work_date)) ||
      String(b.created_at || '').localeCompare(String(a.created_at || ''))
  )
}

// The person's usual rate (null when none is set).
export function usualRate(entry, book) {
  const r = entry.user_id ? book.user[entry.user_id] : entry.worker_id ? book.worker[entry.worker_id] : null
  return r == null ? null : Number(r)
}

// The rate this entry is costed at: its own rate if one was set, otherwise the person's usual rate.
export function rateFor(entry, book) {
  if (book.entry[entry.id] != null) return Number(book.entry[entry.id])
  return usualRate(entry, book)
}

export const personKey = (e) => (e.user_id ? `u:${e.user_id}` : e.worker_id ? `w:${e.worker_id}` : 'x')

// Tasks whose logged hours are already covered by a lump sum.
export function replacedTasks(lumps) {
  return new Set((lumps || []).filter((l) => l.replaces_hours && l.task_id).map((l) => l.task_id))
}

// Lump sums per task id (a sum when there are several).
export function lumpsByTask(lumps) {
  const map = {}
  ;(lumps || []).forEach((l) => {
    if (l.task_id) map[l.task_id] = round2((map[l.task_id] || 0) + Number(l.amount_ex_gst || 0))
  })
  return map
}

// Labour cost = hours x rates + lump sums. Hours on a task whose lump sum "replaces hours" are
// listed but not costed.
export function labourCost(entries, book, lumps = []) {
  const replaced = replacedTasks(lumps)
  const people = new Map()
  entries.forEach((e) => {
    const key = personKey(e)
    const row = people.get(key) || { key, user_id: e.user_id || null, worker_id: e.worker_id || null, hours: 0, cost: 0, unratedHours: 0, replacedHours: 0, rates: [] }
    const h = Number(e.hours || 0)
    row.hours = round2(row.hours + h)
    if (e.task_id && replaced.has(e.task_id)) {
      row.replacedHours = round2(row.replacedHours + h)
    } else {
      const rate = rateFor(e, book)
      if (rate == null) row.unratedHours = round2(row.unratedHours + h)
      else {
        row.cost = round2(row.cost + h * rate)
        if (!row.rates.includes(rate)) row.rates.push(rate)
      }
    }
    people.set(key, row)
  })
  const list = [...people.values()]
  const hourly = round2(list.reduce((s, p) => s + p.cost, 0))
  const lumpTotal = round2((lumps || []).reduce((s, l) => s + Number(l.amount_ex_gst || 0), 0))
  return {
    people: list,
    hours: sumHours(entries),
    hourly,
    unratedHours: round2(list.reduce((s, p) => s + p.unratedHours, 0)),
    replacedHours: round2(list.reduce((s, p) => s + p.replacedHours, 0)),
    lumps: lumps || [],
    lumpTotal,
    total: round2(hourly + lumpTotal)
  }
}

// Dated labour costs for the cash-flow graph: each costed entry on its own day, each lump sum on its date.
export function labourEvents(entries, book, lumps, today) {
  const replaced = replacedTasks(lumps)
  const wages = entries
    .filter((e) => !(e.task_id && replaced.has(e.task_id)))
    .map((e) => ({ date: String(e.work_date).slice(0, 10), amount: round2(Number(e.hours || 0) * Number(rateFor(e, book) || 0)) }))
  const lumpEvents = (lumps || []).map((l) => ({ date: String(l.paid_on || today).slice(0, 10), amount: Number(l.amount_ex_gst || 0) }))
  return [...wages, ...lumpEvents].filter((e) => e.amount !== 0)
}
