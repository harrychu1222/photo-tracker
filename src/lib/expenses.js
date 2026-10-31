// Expense helpers. Every amount is entered and stored exactly as paid or received (GST included, if any).
// The column is still called amount_ex_gst for historical reasons. Negative = refund or credit.

export const EXPENSE_CATEGORIES = [
  { value: 'materials', label: 'Materials' },
  { value: 'equipment', label: 'Equipment' },
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

// material id -> amount actually paid against it.
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

// Quote set-up. mode 'buildup': the five estimates + markup give the quote price.
// mode 'lump': the quote price is typed in. Money is entered as paid, so there is no GST maths.
export const ESTIMATE_LINES = [
  { key: 'est_materials', line: 'materials', label: 'Materials' },
  { key: 'est_equipment', line: 'equipment', label: 'Equipment' },
  { key: 'est_labour', line: 'labour', label: 'Labour' },
  { key: 'est_subcontractors', line: 'subcontractors', label: 'Subcontractors' },
  { key: 'est_other', line: 'other', label: 'Other' }
]

const numOrNull = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

export function estimatesOf(finance) {
  const out = {}
  ESTIMATE_LINES.forEach((l) => {
    out[l.line] = numOrNull(finance?.[l.key])
  })
  return out
}

// Target cost = sum of the estimates in build-up mode (the older typed-in target if no estimate is filled in);
// in lump-sum mode it is the optional target typed in.
export function targetOf(finance) {
  const mode = finance?.quote_mode === 'lump' ? 'lump' : 'buildup'
  const est = estimatesOf(finance)
  const filled = Object.values(est).filter((v) => v != null)
  if (mode === 'buildup' && filled.length > 0) return cents(filled.reduce((s, v) => s + v, 0))
  return numOrNull(finance?.budget)
}

// Header numbers for the admin money box.
// planned: planned materials + equipment from the task lists. wages: hours x rates only.
// lumpTotal: per-task lump sums (subcontracted work).
export function projectMoney(finance, expenses, planned, wages = 0, lumpTotal = 0) {
  const mode = finance?.quote_mode === 'lump' ? 'lump' : 'buildup'
  const markup = Number(finance?.markup_pct ?? 0)
  const target = targetOf(finance)
  let quote = null
  if (mode === 'lump') {
    const q = numOrNull(finance?.quote_lump)
    quote = q != null && q > 0 ? q : null
  } else if (target != null && target > 0) {
    quote = cents(target * (1 + markup / 100))
  }

  const by = (cat) => sumExpenses(expenses.filter((e) => e.category === cat))
  const spend = {
    materials: by('materials'),
    equipment: by('equipment'),
    other: by('other'),
    labour: cents(Number(wages || 0)),
    subcontractors: cents(by('subcontractor') + Number(lumpTotal || 0))
  }
  const actual = cents(Object.values(spend).reduce((s, v) => s + v, 0))
  const estimates = mode === 'buildup' ? estimatesOf(finance) : {}
  const lines = ESTIMATE_LINES.map((l) => {
    const est = estimates[l.line] ?? null
    const act = spend[l.line]
    return { line: l.line, label: l.label, estimate: est, actual: act, diff: est == null ? null : cents(act - est), over: est != null && act > est }
  })
  const diff = target != null && target > 0 ? cents(target - actual) : null
  return {
    mode,
    target,
    quote,
    markup,
    actual,
    spend,
    lines,
    // Spent on bought goods (everything except wages and subcontractors), used by the cash-flow graph labels.
    spentOnGoods: cents(spend.materials + spend.equipment + spend.other),
    labour: cents(spend.labour + spend.subcontractors),
    // What the job is expected to earn if it runs to the target cost.
    expectedMargin: quote != null && target != null ? cents(quote - target) : null,
    planned: planned ?? null,
    vsTarget: diff == null ? null : { diff, over: diff < 0, amount: Math.abs(diff) },
    vsPlanned: planned == null ? null : { diff: cents(planned - (spend.materials + spend.equipment)), over: spend.materials + spend.equipment > planned }
  }
}
