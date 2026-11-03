// Payment schedule helpers. Amounts are cash, GST included, like everything else in the app.
import { dayDiff } from './tasks'

const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100

export const amountFromPct = (quote, pct) => (quote > 0 && Number(pct) >= 0 ? round((quote * Number(pct)) / 100) : null)

// received = a payment is linked. Order: earliest due first, undated last, then entry order.
export function sortMilestones(list) {
  return [...list].sort((a, b) => (a.due_on || '9999') .localeCompare(b.due_on || '9999') || (a.sort_order || 0) - (b.sort_order || 0))
}

export function milestoneState(m, today) {
  if (m.payment_id) return { kind: 'received' }
  if (!m.due_on) return { kind: 'undated' }
  const days = dayDiff(today, m.due_on)
  return days < 0 ? { kind: 'overdue', days: -days } : { kind: 'due', days }
}

export function scheduleTotals(milestones, quote) {
  const scheduled = round(milestones.reduce((s, m) => s + Number(m.amount || 0), 0))
  const received = round(milestones.filter((m) => m.payment_id).reduce((s, m) => s + Number(m.amount || 0), 0))
  return {
    scheduled,
    received,
    toCome: round(scheduled - received),
    unscheduled: quote != null && quote > 0 ? round(quote - scheduled) : null
  }
}

// The next payment still to come (overdue ones first because they are earliest).
export function nextPayment(milestones, today) {
  const open = sortMilestones(milestones.filter((m) => !m.payment_id))
  if (open.length === 0) return null
  const m = open[0]
  return { milestone: m, state: milestoneState(m, today) }
}

// A usual four-part split of the quote; the last part takes the rounding.
export function standardSplit(quote) {
  const parts = [['Deposit', 20], ['Progress payment 1', 40], ['Progress payment 2', 30], ['Final payment', 10]]
  let left = round(quote)
  return parts.map(([name, pct], i) => {
    const amount = i === parts.length - 1 ? left : amountFromPct(quote, pct)
    left = round(left - amount)
    return { name, amount }
  })
}
