import { useState } from 'react'
import { useWork } from '../../context/WorkContext'
import { fmtDate, fmtMoney } from '../../lib/format'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'
const labelClass = 'mb-1 block text-sm font-medium text-ink-800'
const chip = (on) => `whitespace-nowrap min-h-[36px] rounded-full border px-3.5 text-sm font-medium ${on ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-600'}`
const STATUSES = [
  { value: 'pending', label: 'Pending', cls: 'bg-[#FBEAD2] text-[#7A4B05]' },
  { value: 'approved', label: 'Approved', cls: 'bg-[#DDEBDD] text-[#1F5A2B]' },
  { value: 'declined', label: 'Declined', cls: 'bg-ink-100 text-ink-600' }
]
const HOW = ['Email', 'Verbal', 'Text message', 'Signed']
const signed = (n) => (n < 0 ? `-${fmtMoney(Math.abs(n))}` : `+${fmtMoney(n)}`)

function VariationForm({ project, variation, onDone }) {
  const { addVariation, updateVariation } = useWork()
  const [f, setF] = useState({
    title: variation?.title || '',
    description: variation?.description || '',
    amount: variation ? String(variation.amount) : '',
    status: variation?.status || 'pending',
    approvedBy: variation?.approved_by || '',
    approvedHow: variation?.approved_how || ''
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (variation) await updateVariation(variation.id, f, variation.status === f.status ? variation.decided_on : null)
      else await addVariation(project.id, f)
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="mb-4 space-y-3 rounded-xl border border-ink-100 bg-ink-50 p-3" aria-label="Variation form">
      <p className="text-sm font-semibold text-ink-900">{variation ? `Edit variation ${variation.number}` : 'New variation'}</p>
      <div>
        <label htmlFor="va-title" className={labelClass}>What is changing</label>
        <input id="va-title" value={f.title} onChange={set('title')} placeholder="e.g. Extra power point in the study" className={inputClass} />
      </div>
      <div>
        <label htmlFor="va-amount" className={labelClass}>Price change ($)</label>
        <input id="va-amount" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="e.g. 350 (use -120 for a credit)" className={inputClass} />
      </div>
      <div>
        <label htmlFor="va-desc" className={labelClass}>Details (optional)</label>
        <textarea id="va-desc" rows={2} value={f.description} onChange={set('description')} className={inputClass} />
      </div>
      <div>
        <label htmlFor="va-status" className={labelClass}>Status</label>
        <select id="va-status" value={f.status} onChange={set('status')} className={inputClass}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      {f.status === 'approved' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="va-by" className={labelClass}>Approved by</label>
            <input id="va-by" value={f.approvedBy} onChange={set('approvedBy')} placeholder="e.g. Mrs Smith" className={inputClass} />
          </div>
          <div>
            <label htmlFor="va-how" className={labelClass}>How</label>
            <input id="va-how" list="va-how-list" value={f.approvedHow} onChange={set('approvedHow')} placeholder="Email, verbal, signed" className={inputClass} />
            <datalist id="va-how-list">{HOW.map((h) => <option key={h} value={h} />)}</datalist>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-status-blocked" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="min-h-[44px] rounded-lg bg-signal-500 px-5 text-sm font-semibold text-ink-950 disabled:opacity-60">{variation ? 'Save changes' : 'Add variation'}</button>
        <button type="button" onClick={onDone} className="min-h-[44px] rounded-lg border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-900">Cancel</button>
      </div>
    </form>
  )
}

export default function VariationsTab({ project }) {
  const { variationsByProject, variationsError, updateVariation, deleteVariation } = useWork()
  const all = variationsByProject[project.id] || []
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null) // 'new' | a variation | null
  const [error, setError] = useState(null)

  const sum = (st) => all.filter((v) => v.status === st).reduce((t, v) => t + Number(v.amount), 0)
  const count = (st) => all.filter((v) => v.status === st).length
  const rows = all.filter((v) => filter === 'all' || v.status === filter)

  async function act(fn) {
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    }
  }
  const decide = (v, status) => act(() => updateVariation(v.id, { title: v.title, description: v.description, amount: v.amount, status, approvedBy: v.approved_by, approvedHow: v.approved_how }))

  if (variationsError) return <p className="text-sm text-status-blocked">{variationsError}</p>

  return (
    <div>
      {editing ? (
        <VariationForm key={editing === 'new' ? 'new' : editing.id} project={project} variation={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <button onClick={() => setEditing('new')} className="mb-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-signal-500 px-4 text-sm font-semibold text-ink-950 active:bg-signal-600 sm:w-auto">
          + Add variation
        </button>
      )}

      {all.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2" data-testid="variation-totals">
          <div className="rounded-xl border border-ink-100 bg-white p-3">
            <p className="text-xs text-ink-600">Approved ({count('approved')})</p>
            <p className="text-lg font-semibold text-ink-900">{signed(sum('approved'))}</p>
          </div>
          <div className="rounded-xl border border-ink-100 bg-white p-3">
            <p className="text-xs text-ink-600">Waiting for a yes ({count('pending')})</p>
            <p className="text-lg font-semibold text-ink-900">{signed(sum('pending'))}</p>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Variation status filter">
        <button onClick={() => setFilter('all')} className={chip(filter === 'all')} aria-pressed={filter === 'all'}>All ({all.length})</button>
        {STATUSES.map((s) => (
          <button key={s.value} onClick={() => setFilter(s.value)} className={chip(filter === s.value)} aria-pressed={filter === s.value}>{s.label} ({count(s.value)})</button>
        ))}
      </div>
      {error && <p className="mb-3 text-sm text-status-blocked" role="alert">{error}</p>}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-200 py-10 text-center text-sm text-ink-600">
          {all.length === 0 ? 'No variations yet. Record a change to the job here, with its price, so nothing gets forgotten at invoice time.' : 'No variations match this filter.'}
        </p>
      ) : (
        <ul className="space-y-2" data-testid="variation-list">
          {rows.map((v) => {
            const st = STATUSES.find((s) => s.value === v.status) || STATUSES[0]
            const detail = [`Raised ${fmtDate(v.raised_on)}`, v.status !== 'pending' && v.decided_on ? `${st.label} ${fmtDate(v.decided_on)}` : null, v.approved_by ? `by ${v.approved_by}` : null, v.approved_how ? `(${v.approved_how})` : null].filter(Boolean).join(' · ')
            return (
              <li key={v.id} className="rounded-xl border border-ink-100 bg-white p-3" data-testid={`variation-${v.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => setEditing(v)} className="min-w-0 flex-1 text-left" aria-label={`Edit variation ${v.number}`}>
                    <p className={`text-sm font-semibold ${v.status === 'declined' ? 'text-ink-600 line-through' : 'text-ink-900'}`}>V{v.number} · {v.title}</p>
                    <p className="mt-0.5 text-xs text-ink-600">{detail}</p>
                    {v.description && <p className="mt-1 text-xs text-ink-600">{v.description}</p>}
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold text-ink-900">{signed(Number(v.amount))}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {v.status === 'pending' ? (
                    <>
                      <button onClick={() => setEditing({ ...v, status: 'approved' })} className="min-h-[44px] min-h-[44px] rounded-lg bg-ink-900 px-3 text-sm font-semibold text-white" aria-label={`Approve variation ${v.number}`}>Approve</button>
                      <button onClick={() => decide(v, 'declined')} className="min-h-[44px] min-h-[44px] rounded-lg border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-900" aria-label={`Decline variation ${v.number}`}>Declined</button>
                    </>
                  ) : (
                    <button onClick={() => decide(v, 'pending')} className="min-h-[44px] min-h-[44px] rounded-lg border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-900" aria-label={`Reopen variation ${v.number}`}>Back to pending</button>
                  )}
                  <button onClick={() => act(() => deleteVariation(v.id))} className="min-h-[44px] min-h-[44px] px-2 text-sm font-medium text-ink-400 underline" aria-label={`Delete variation ${v.number}`}>Delete</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
