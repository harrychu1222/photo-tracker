import { fmtMoney } from '../../lib/format'
import { fmtHours } from '../../lib/tasks'

// The admin-only money box: quote, target, estimate vs actual per cost line, received.
export default function MoneyBox({ money, paid, labourHours }) {
  return (
    <section className="rounded-xl border border-ink-100 bg-white p-4" data-testid="money-box" aria-label="Money">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-ink-600">Money (admins only)</p>
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-600">Quote price{money.mode === 'buildup' && money.quote != null ? ` (${money.markup}% markup)` : ''}</dt>
          <dd className="font-semibold text-ink-900" data-testid="money-quote">{money.quote == null ? '—' : fmtMoney(money.quote)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-600">Target cost</dt>
          <dd className="text-ink-900" data-testid="money-target">{money.target == null ? '—' : fmtMoney(money.target)}</dd>
        </div>
        {money.expectedMargin != null && (
          <div className="flex justify-between">
            <dt className="text-ink-600">Expected margin</dt>
            <dd className="text-ink-900">{fmtMoney(money.expectedMargin)}</dd>
          </div>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-x-3 border-t border-ink-100 pt-2 text-xs text-ink-400">
          <span>Cost</span>
          <span className="text-right">Estimate</span>
          <span className="text-right">Actual</span>
        </div>
        {money.lines.map((l) => (
          <div key={l.line} className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-x-3 text-sm tabular-nums" data-testid={`line-${l.line}`}>
            <span className="text-ink-600">
              {l.line === 'materials' ? 'Materials' : l.line === 'other' ? 'Other expenses' : l.label}
              {l.line === 'labour' && labourHours > 0 ? <span className="text-xs text-ink-400"> · {fmtHours(labourHours)}</span> : null}
            </span>
            <span className="text-right text-ink-600">{l.estimate == null ? '—' : fmtMoney(l.estimate)}</span>
            <span className={`text-right ${l.over ? 'font-medium text-status-blocked' : 'text-ink-900'}`}>{fmtMoney(l.actual)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-ink-100 pt-2 font-semibold">
          <dt className="text-ink-800">Total spent</dt>
          <dd className="text-ink-900" data-testid="money-actual">{fmtMoney(money.actual)}</dd>
        </div>
        <div className="flex justify-between border-t border-ink-100 pt-2">
          <dt className="text-ink-600">Received</dt>
          <dd className="text-ink-900" data-testid="money-received">{fmtMoney(paid.received)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt className="text-ink-800">Net (received − spent)</dt>
          <dd className={paid.received - money.actual < 0 ? 'text-status-blocked' : 'text-ink-900'} data-testid="money-net">
            {fmtMoney(Math.round((paid.received - money.actual) * 100) / 100)}
          </dd>
        </div>
        {paid.toReceive != null && (
          <div className="flex justify-between">
            <dt className="text-ink-600">Still to receive</dt>
            <dd className="text-ink-900">{fmtMoney(paid.toReceive)}</dd>
          </div>
        )}
      </dl>
      {money.vsTarget && (
        <p className={`mt-2 text-xs font-medium ${money.vsTarget.over ? 'text-status-blocked' : 'text-status-done'}`}>
          {money.vsTarget.over ? 'Over' : 'Under'} target by {fmtMoney(money.vsTarget.amount)} so far
        </p>
      )}
      <p className="mt-1 text-xs text-ink-400">Everything is as paid or received, GST included. Subcontractors are lump sums plus subcontractor expenses.</p>
    </section>
  )
}
