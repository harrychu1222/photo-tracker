// Expense helpers. Stored amounts are ex-GST dollars; negative = refund or credit.

export const GST_RATE = 0.1

export const EXPENSE_CATEGORIES = [
  { value: 'materials', label: 'Materials' },
  { value: 'equipment', label: 'Equipment hire' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'other', label: 'Other' }
]

export const categoryLabel = (value) => EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || 'Other'

const cents = (n) => Math.round((n + Number.EPSILON) * 100) / 100

// Parse what was typed ("1,234.50", "$80"). Returns a number or null.
export function parseAmount(text) {
  if (text == null) return null
  const s = String(text).replace(/[$,\s]/g, '')
  if (s === '' || s === '-' || s === '.') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// The ex-GST amount to store, given what was typed and whether it includes GST.
export function exGstFromEntered(value, includesGst) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return includesGst ? cents(n / (1 + GST_RATE)) : cents(n)
}

export const incGst = (exGst) => cents(Number(exGst || 0) * (1 + GST_RATE))

export function sumExpenses(list) {
  return cents(list.reduce((s, e) => s + Number(e.amount_ex_gst || 0), 0))
}

// Totals per category (always all four, in order) plus the grand total.
export function totalsByCategory(list) {
  const rows = EXPENSE_CATEGORIES.map((c) => ({
    ...c,
    total: sumExpenses(list.filter((e) => e.category === c.value)),
    count: list.filter((e) => e.category === c.value).length
  }))
  return { rows, total: sumExpenses(list) }
}

// material id -> amount actually paid against it (ex-GST).
export function actualByMaterial(list) {
  const map = {}
  list.forEach((e) => {
    if (!e.material_id) return
    map[e.material_id] = cents((map[e.material_id] || 0) + Number(e.amount_ex_gst || 0))
  })
  return map
}

// Planned vs actual for one material line. `planned` is null when unpriced or hidden.
export function materialVariance(planned, actual) {
  if (actual == null) return null
  if (planned == null) return { planned: null, actual, diff: null, over: false }
  const diff = cents(actual - planned)
  return { planned, actual, diff, over: diff > 0 }
}

// Newest first; ties by creation time.
export function sortExpenses(list) {
  return [...list].sort(
    (a, b) =>
      String(b.expense_date).localeCompare(String(a.expense_date)) ||
      String(b.created_at || '').localeCompare(String(a.created_at || ''))
  )
}

// Header numbers for the admin money box.
// finance: { budget, markup_pct, gst_enabled }, planned: planned materials+equipment (ex-GST).
export function projectMoney(finance, expenses, planned) {
  const target = finance?.budget != null && finance.budget !== '' ? Number(finance.budget) : null
  const markup = Number(finance?.markup_pct ?? 0)
  const gst = finance?.gst_enabled ?? true
  const quoteEx = target != null && target > 0 ? cents(target * (1 + markup / 100)) : null
  const quote = quoteEx == null ? null : gst ? cents(quoteEx * (1 + GST_RATE)) : quoteEx
  const actual = sumExpenses(expenses)
  const diff = target != null && target > 0 ? cents(target - actual) : null
  return {
    target,
    quoteEx,
    quote,
    gst,
    actual,
    planned: planned ?? null,
    vsTarget: diff == null ? null : { diff, over: diff < 0, amount: Math.abs(diff) },
    vsPlanned: planned == null ? null : { diff: cents(planned - actual), over: actual > planned }
  }
}
