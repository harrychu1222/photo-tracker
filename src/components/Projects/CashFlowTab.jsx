import { useState } from 'react'
import CashFlowChart, { FiguresTable } from './CashFlowChart'
import { useWork } from '../../context/WorkContext'
import { buildCashFlow, receivedSummary } from '../../lib/cashflow'
import { labourCost, labourEvents } from '../../lib/labour'
import { exGstFromEntered, incGst, parseAmount, projectMoney } from '../../lib/expenses'
import { fmtDate, fmtMoney } from '../../lib/format'
import { todayLocal } from '../../lib/tasks'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-base focus:border-signal-500'
const chip = (on) =>
  `rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'}`

function PaymentForm({ project, payment, onDone }) {
  const { addPayment, updatePayment } = useWork()
  const [date, setDate] = useState(payment?.received_on || todayLocal())
  const [description, setDescription] = useState(payment?.description || '')
  const [amount, setAmount] = useState(payment ? String(payment.amount_ex_gst) : '')
  const [hasGst, setHasGst] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const typed = parseAmount(amount)
  const ex = typed == null ? null : exGstFromEntered(typed, hasGst)

  async function save(e) {
    e.preventDefault()
    if (typed == null) return setError('Enter the amount.')
    setBusy(true)
    setError(null)
    const fields = { received_on: date || todayLocal(), description, amount_ex_gst: ex }
    try {
      if (payment) await updatePayment(payment.id, fields)
      else await addPayment(project.id, fields)
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="mb-4 space-y-3 rounded-xl border border-ink-100 bg-ink-50 p-3">
      <p className="text-sm font-semibold text-ink-900">{payment ? 'Edit payment' : 'Payment received'}</p>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} aria-label="Received on" />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Deposit, Progress claim 2" className={inputClass} aria-label="Payment description" />
      <div>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount ($)" className={inputClass} aria-label="Payment amount" />
        <label className="mt-1.5 flex items-center gap-2 text-sm text-ink-800">
          <input type="checkbox" checked={hasGst} onChange={(e) => setHasGst(e.target.checked)} className="h-4 w-4" />
          This amount includes GST
        </label>
        {ex != null && (
          <p className="mt-1 text-xs text-ink-600">
            Recorded as {fmtMoney(ex)} ex-GST ({fmtMoney(incGst(ex))} with GST).
          </p>
        )}
      </div>
      {error && <p className="text-sm text-status-blocked">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {payment ? 'Save changes' : 'Save payment'}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-600">
          Cancel
        </button>
      </div>
    </form>
  )
}

// Admin only: payments received and the spent-vs-received line graph.
export default function CashFlowTab({ project, finance }) {
  const { paymentsByProject, paymentsError, expensesByProject, deletePayment, timeByProject, rates } = useWork()
  const [editing, setEditing] = useState(null)
  const [gst, setGst] = useState(false)
  const [showNet, setShowNet] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const [error, setError] = useState(null)

  const payments = paymentsByProject[project.id] || []
  const expenses = expensesByProject[project.id] || []
  const time = timeByProject[project.id] || []
  const money = projectMoney(finance, expenses, null, labourCost(time, rates, finance).total)
  const sum = receivedSummary(payments, money.quoteEx)
  const data = buildCashFlow(expenses, payments, { gst, today: todayLocal(), quoteEx: money.quoteEx, labour: labourEvents(time, rates, finance, todayLocal()) })
  const sorted = [...payments].sort((a, b) => String(b.received_on).localeCompare(String(a.received_on)))
  const k = gst ? 1.1 : 1
  const spentNow = data?.points.at(-1).spent ?? 0
  const receivedNow = data?.points.at(-1).received ?? 0

  async function remove(p) {
    if (!confirm(`Delete "${p.description}"?`)) return
    setError(null)
    try {
      await deletePayment(p.id)
    } catch (err) {
      setError(err.message)
    }
  }

  if (paymentsError) return <p className="text-sm text-status-blocked">{paymentsError}</p>

  return (
    <div>
      <div className="mb-4 rounded-xl border border-ink-100 bg-ink-50 p-3 text-sm">
        <p className="mb-2 text-xs font-semibold text-ink-800">Cash flow, {gst ? 'with GST' : 'ex-GST'} (admins only)</p>
        <dl className="space-y-1">
          <div className="flex justify-between">
            <dt className="text-ink-600">Received so far</dt>
            <dd className="text-ink-900">{fmtMoney(receivedNow)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-600">Spent so far (expenses + labour)</dt>
            <dd className="text-ink-900">{fmtMoney(spentNow)}</dd>
          </div>
          <div className="flex justify-between border-t border-ink-100 pt-1 font-semibold">
            <dt className="text-ink-800">Net (received − spent)</dt>
            <dd className={receivedNow - spentNow < 0 ? 'text-status-blocked' : 'text-ink-900'}>{fmtMoney(Math.round((receivedNow - spentNow) * 100) / 100)}</dd>
          </div>
          {sum.toReceive != null && (
            <div className="flex justify-between">
              <dt className="text-ink-600">Still to receive of the quote</dt>
              <dd className="text-ink-900">{fmtMoney(Math.round(sum.toReceive * k * 100) / 100)}</dd>
            </div>
          )}
        </dl>
        {sum.toReceive == null && <p className="mt-1 text-xs text-ink-400">Set a target cost on the project to see the quote line and what is left to receive.</p>}
      </div>

      {data ? (
        <div className="mb-4 rounded-xl border border-ink-100 bg-white p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <button onClick={() => setGst(false)} className={chip(!gst)} aria-pressed={!gst}>
              Ex-GST
            </button>
            <button onClick={() => setGst(true)} className={chip(gst)} aria-pressed={gst}>
              With GST
            </button>
            <button onClick={() => setShowNet((v) => !v)} className={chip(showNet)} aria-pressed={showNet}>
              Show net line
            </button>
          </div>
          <CashFlowChart
            data={data}
            showNet={showNet}
            label={`Cumulative spent ${fmtMoney(spentNow)} and received ${fmtMoney(receivedNow)}, ${gst ? 'with GST' : 'ex-GST'}`}
          />
          <button onClick={() => setShowTable((v) => !v)} className="mt-3 text-xs font-medium text-signal-600" aria-expanded={showTable}>
            {showTable ? 'Hide figures' : 'Show figures'}
          </button>
          {showTable && (
            <div className="mt-2">
              <FiguresTable points={data.points} />
            </div>
          )}
        </div>
      ) : (
        <p className="mb-4 rounded-xl border border-dashed border-ink-200 py-8 text-center text-sm text-ink-600">
          The graph appears once there is an expense or a payment.
        </p>
      )}

      {editing ? (
        <PaymentForm key={editing === 'new' ? 'new' : editing.id} project={project} payment={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <button onClick={() => setEditing('new')} className="mb-4 rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white">
          + Add payment received
        </button>
      )}
      {error && <p className="mb-3 text-sm text-status-blocked">{error}</p>}

      <ul className="space-y-2">
        {sorted.map((p) => (
          <li key={p.id} className="rounded-xl border border-ink-100 bg-white p-3 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold text-ink-900">{p.description}</p>
              <span className="font-semibold text-status-done">{fmtMoney(Number(p.amount_ex_gst) * k)}</span>
            </div>
            <p className="mt-0.5 text-xs text-ink-600">{fmtDate(p.received_on)}</p>
            <div className="mt-2 flex gap-3 text-xs font-medium">
              <button onClick={() => setEditing(p)} className="text-ink-600">
                Edit
              </button>
              <button onClick={() => remove(p)} className="text-status-blocked">
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
