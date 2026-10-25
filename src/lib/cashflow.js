// Cumulative cash flow for one project: money spent (expenses) vs money received (payments).
// Amounts are stored ex-GST; the graph can show them with GST added.
import { GST_RATE } from './expenses'

const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100

export function dayNumber(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000
}

// expenses: { expense_date, amount_ex_gst, category }, payments: { received_on, amount_ex_gst }
// opts: { gst: boolean, today: 'YYYY-MM-DD', quoteEx: number|null, labour: [{ date, amount }] }
// Two cost lines: "goods" (materials, equipment hire, other expenses) and "labour" (wages, lump
// sums, and subcontractor expenses). Expenses are invoices, so the GST view adds GST to them;
// wages and lump sums are not grossed up.
// Returns { points: [{ date, day, goods, labour, spent, received, net }], quote, min, max } or null.
export function buildCashFlow(expenses, payments, opts = {}) {
  const k = opts.gst ? 1 + GST_RATE : 1
  const events = [
    ...expenses.map((e) => {
      const amount = Number(e.amount_ex_gst || 0)
      const labourLine = e.category === 'subcontractor'
      return { date: String(e.expense_date).slice(0, 10), goods: labourLine ? 0 : amount * k, labour: labourLine ? amount * k : 0, received: 0 }
    }),
    ...payments.map((p) => ({ date: String(p.received_on).slice(0, 10), goods: 0, labour: 0, received: Number(p.amount_ex_gst || 0) * k })),
    ...(opts.labour || []).map((l) => ({ date: String(l.date).slice(0, 10), goods: 0, labour: Number(l.amount || 0), received: 0 }))
  ]
  if (events.length === 0) return null
  const dates = [...new Set(events.map((e) => e.date))].sort()
  // The lines run on to today so a quiet stretch is visible.
  if (opts.today && opts.today > dates[dates.length - 1]) dates.push(opts.today)

  let goods = 0
  let labour = 0
  let received = 0
  const points = dates.map((date) => {
    events.filter((e) => e.date === date).forEach((e) => {
      goods += e.goods
      labour += e.labour
      received += e.received
    })
    const g = round(goods)
    const l = round(labour)
    const r = round(received)
    return { date, day: dayNumber(date), goods: g, labour: l, spent: round(g + l), received: r, net: round(r - g - l) }
  })
  const quote = opts.quoteEx != null && opts.quoteEx > 0 ? round(opts.quoteEx * k) : null
  const values = points.flatMap((p) => [p.goods, p.labour, p.spent, p.received, p.net]).concat(quote != null ? [quote] : [0], [0])
  return { points, quote, min: Math.min(...values), max: Math.max(...values) }
}

// A tidy axis: step values from min to max (always including 0 when in range).
export function niceTicks(min, max, count = 4) {
  if (max === min) return [min]
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)
  const start = Math.floor(min / step) * step
  const out = []
  for (let v = start; v <= max + step * 0.999; v += step) out.push(round(v))
  return out
}

// Money received and what is still to come, in the units the money box uses (ex-GST).
export function receivedSummary(payments, quoteEx) {
  const received = round(payments.reduce((s, p) => s + Number(p.amount_ex_gst || 0), 0))
  return { received, toReceive: quoteEx != null && quoteEx > 0 ? round(quoteEx - received) : null }
}
