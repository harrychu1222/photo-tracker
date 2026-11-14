import { useState } from 'react'
import ExpenseForm from './ExpenseForm'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { fmtDate, fmtMoney } from '../../lib/format'
import { EXPENSE_CATEGORIES, categoryLabel, sortExpenses, totalsByCategory } from '../../lib/expenses'

const chip = (on) =>
  `rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'}`

// Money actually spent. Admins see every expense and the totals; crew see and manage only the
// ones they entered themselves, with no totals.
export default function ExpensesTab({ project }) {
  const { isAdmin, user } = useAuth()
  const { expensesByProject, expensesError, people, materials, deleteExpense, receiptUrl } = useWork()
  const [editing, setEditing] = useState(null) // null | 'new' | expense
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState(null)
  const [viewing, setViewing] = useState(null)

  const all = expensesByProject[project.id] || []
  const shown = sortExpenses(all.filter((e) => filter === 'all' || e.category === filter))
  const totals = totalsByCategory(all)
  const materialName = (id) => materials.find((m) => m.id === id)?.name

  async function remove(e) {
    if (!confirm(`Delete "${e.description}"?`)) return
    setError(null)
    try {
      await deleteExpense(e)
    } catch (err) {
      setError(err.message)
    }
  }

  async function showReceipt(e) {
    setError(null)
    try {
      setViewing(await receiptUrl(e.receipt_path))
    } catch (err) {
      setError(err.message)
    }
  }

  if (expensesError) return <p className="text-sm text-status-blocked">{expensesError}</p>

  return (
    <div>
      {editing ? (
        <ExpenseForm
          key={editing === 'new' ? 'new' : editing.id}
          project={project}
          expense={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : (
        <button onClick={() => setEditing('new')} className="mb-4 rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white">
          + Add expense
        </button>
      )}
      {error && <p className="mb-3 text-sm text-status-blocked">{error}</p>}

      {isAdmin && all.length > 0 && (
        <div className="mb-4 rounded-xl border border-ink-100 bg-ink-50 p-3 text-sm">
          <p className="mb-2 text-xs font-semibold text-ink-800">Spent so far (admins only)</p>
          <dl className="space-y-1">
            {totals.rows
              .filter((r) => r.count > 0)
              .map((r) => (
                <div key={r.value} className="flex justify-between">
                  <dt className="text-ink-600">{r.label}</dt>
                  <dd className="text-ink-900">{fmtMoney(r.total)}</dd>
                </div>
              ))}
            <div className="flex justify-between border-t border-ink-100 pt-1 font-semibold">
              <dt className="text-ink-800">Total</dt>
              <dd className="text-ink-900">{fmtMoney(totals.total)}</dd>
            </div>
          </dl>
        </div>
      )}

      {!isAdmin && all.length > 0 && <p className="mb-3 text-xs text-ink-600">You only see the expenses you entered.</p>}

      {isAdmin && all.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button onClick={() => setFilter('all')} className={chip(filter === 'all')} aria-pressed={filter === 'all'}>
            All ({all.length})
          </button>
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setFilter(filter === c.value ? 'all' : c.value)}
              className={chip(filter === c.value)}
              aria-pressed={filter === c.value}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {all.length === 0 && !editing && (
        <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">
          {isAdmin ? 'No expenses yet.' : 'You have not entered any expenses for this project.'}
        </p>
      )}

      <ul className="space-y-2">
        {shown.map((e) => {
          const mine = e.created_by === user?.id
          return (
            <li key={e.id} className="rounded-xl border border-ink-100 bg-white p-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 font-semibold text-ink-900">{e.description}</p>
                <span className={`flex-shrink-0 font-semibold ${Number(e.amount_ex_gst) < 0 ? 'text-status-done' : 'text-ink-900'}`}>
                  {fmtMoney(e.amount_ex_gst)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-600">
                {fmtDate(e.expense_date)} · {categoryLabel(e.category)}
                {e.supplier ? ` · ${e.supplier}` : ''}
                {e.material_id && materialName(e.material_id) ? ` · for ${materialName(e.material_id)}` : ''}
                {isAdmin && !mine && people[e.created_by] ? ` · entered by ${people[e.created_by]}` : ''}
              </p>
              <div className="mt-2 flex gap-3 text-xs font-medium">
                {e.receipt_path && (
                  <button onClick={() => showReceipt(e)} className="text-signal-600">
                    View receipt
                  </button>
                )}
                {(isAdmin || mine) && (
                  <>
                    <button onClick={() => setEditing(e)} className="text-ink-600">
                      Edit
                    </button>
                    <button onClick={() => remove(e)} className="text-status-blocked">
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setViewing(null)}>
          <img src={viewing} alt="Receipt" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}
