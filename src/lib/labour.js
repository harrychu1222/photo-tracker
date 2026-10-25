// Hours worked and labour cost. Hours come from time_entries; rates (admins only) from person_rates.

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

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

export const hasLump = (finance) =>
  finance?.labour_lump_sum != null && finance.labour_lump_sum !== '' && Number(finance.labour_lump_sum) >= 0

// rates: user id -> hourly rate. Returns per-person hours and cost, plus the project labour total.
// With a lump sum set, the lump sum is the labour cost and hours x rates is ignored.
export function labourCost(entries, rates, finance) {
  const people = new Map()
  entries.forEach((e) => {
    const key = e.user_id || 'unknown'
    const row = people.get(key) || { user_id: e.user_id, hours: 0 }
    row.hours = round2(row.hours + Number(e.hours || 0))
    people.set(key, row)
  })
  const list = [...people.values()].map((p) => {
    const rate = p.user_id != null && rates[p.user_id] != null ? Number(rates[p.user_id]) : null
    return { ...p, rate, cost: rate == null ? null : round2(p.hours * rate) }
  })
  const hourly = round2(list.reduce((s, p) => s + (p.cost || 0), 0))
  const unratedHours = round2(list.filter((p) => p.rate == null).reduce((s, p) => s + p.hours, 0))
  const lump = hasLump(finance)
  return {
    people: list,
    hours: sumHours(entries),
    hourly,
    unratedHours,
    usesLump: lump,
    lump: lump ? round2(Number(finance.labour_lump_sum)) : null,
    total: lump ? round2(Number(finance.labour_lump_sum)) : hourly
  }
}

// Dated labour costs for the cash-flow graph: each entry on its own day, or the lump sum on one day.
export function labourEvents(entries, rates, finance, today) {
  if (hasLump(finance)) {
    const amount = Number(finance.labour_lump_sum)
    return amount > 0 ? [{ date: finance.labour_lump_on || today, amount }] : []
  }
  return entries
    .map((e) => ({ date: String(e.work_date).slice(0, 10), amount: round2(Number(e.hours || 0) * Number(rates[e.user_id] || 0)) }))
    .filter((e) => e.amount !== 0)
}
