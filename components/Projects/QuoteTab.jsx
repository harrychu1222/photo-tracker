import { useMemo, useState } from 'react'
import { useWork } from '../../context/WorkContext'
import { fmtDate, fmtMoney } from '../../lib/format'
import { amountFromPct, milestoneState, scheduleTotals, sortMilestones, standardSplit } from '../../lib/payments'
import { buildQuotePdf } from '../../lib/quotepdf'
import { autoGstNote, defaultLines, mergeLines } from '../../lib/quotelines'
import { todayLocal } from '../../lib/tasks'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'
const labelClass = 'mb-1 block text-sm font-medium text-ink-800'
const primary = 'min-h-[44px] rounded-lg bg-signal-500 px-5 text-sm font-semibold text-ink-950 active:bg-signal-600 disabled:opacity-60'
const secondary = 'min-h-[44px] rounded-lg border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-900'
const small = 'min-h-[40px] rounded-lg border border-ink-200 bg-white px-3 text-xs font-semibold text-ink-900'
const seg = (on) => `min-h-[40px] rounded-lg px-3 text-xs font-semibold ${on ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600'}`

// ---------- Quote PDF ----------

function QuoteDialog({ project, quote, milestones, draft, onEditWording, onClose }) {
  const { business, saveBusiness } = useWork()
  const [f, setF] = useState({
    name: business?.name || '',
    abn: business?.abn || '',
    phone: business?.phone || '',
    email: business?.email || '',
    address: business?.address || '',
    terms: business?.terms || '',
    valid_days: business?.valid_days || 30
  })
  const shown = draft.lines.filter((l) => l.on !== false)
  const [includeSchedule, setIncludeSchedule] = useState(milestones.length > 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }))

  async function create() {
    setBusy(true)
    setError(null)
    try {
      const saved = await saveBusiness(f)
      const date = todayLocal()
      const bytes = await buildQuotePdf({
        business: saved,
        project,
        quote,
        lines: shown,
        milestones: sortMilestones(milestones),
        notes: draft.notes,
        priceLabel: draft.priceLabel,
        gstNote: draft.gstNote,
        includeSchedule,
        date
      })
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `Quote - ${project.name} - ${date}.pdf`.replace(/[\\/:*?"<>|]/g, '-')
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 pb-8 sm:rounded-2xl" role="dialog" aria-label="Create quote PDF">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">Create quote PDF</h2>
          <button onClick={onClose} className="text-2xl leading-none text-ink-400" aria-label="Close">×</button>
        </div>
        <p className="mb-1 text-sm text-ink-600">Quote price: <b className="text-ink-900">{fmtMoney(quote)}</b> (GST included).</p>
        <p className="mb-3 text-sm text-ink-600">
          {shown.length} line{shown.length === 1 ? '' : 's'} of work will be listed.{' '}
          <button onClick={onEditWording} className="font-semibold text-ink-900 underline">Edit the wording</button>
        </p>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-600">Your business (saved for next time)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="qb-name" className={labelClass}>Business name</label>
            <input id="qb-name" value={f.name} onChange={set('name')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="qb-abn" className={labelClass}>ABN</label>
            <input id="qb-abn" value={f.abn} onChange={set('abn')} className={inputClass} />
          </div>
          <div>
            <label htmlFor="qb-phone" className={labelClass}>Phone</label>
            <input id="qb-phone" value={f.phone} onChange={set('phone')} inputMode="tel" className={inputClass} />
          </div>
          <div>
            <label htmlFor="qb-email" className={labelClass}>Email</label>
            <input id="qb-email" value={f.email} onChange={set('email')} inputMode="email" className={inputClass} />
          </div>
          <div>
            <label htmlFor="qb-valid" className={labelClass}>Quote valid for (days)</label>
            <input id="qb-valid" type="number" min="1" max="365" value={f.valid_days} onChange={set('valid_days')} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="qb-address" className={labelClass}>Address</label>
            <input id="qb-address" value={f.address} onChange={set('address')} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="qb-terms" className={labelClass}>Terms and conditions (optional)</label>
            <textarea id="qb-terms" rows={3} value={f.terms} onChange={set('terms')} className={inputClass} />
          </div>
        </div>
        <label className="mt-3 flex min-h-[44px] items-center gap-2 text-sm text-ink-800">
          <input type="checkbox" checked={includeSchedule} onChange={(e) => setIncludeSchedule(e.target.checked)} disabled={milestones.length === 0} className="h-5 w-5" aria-label="Include the payment schedule" />
          Include the payment schedule{milestones.length === 0 ? ' (none yet)' : ''}
        </label>
        {error && <p className="mt-2 text-sm text-status-blocked" role="alert">{error}</p>}
        <button onClick={create} disabled={busy} className={`${primary} mt-3 w-full`}>{busy ? 'Creating…' : 'Create PDF'}</button>
      </div>
    </div>
  )
}

// ---------- Quote wording ----------

// Reword the work lines, add the materials or grade, reorder or hide lines, and edit the price lines.
function QuoteEditor({ project, quote, draft, defaults, onDone }) {
  const { saveQuoteDraft } = useWork()
  const [lines, setLines] = useState(draft.lines)
  const [notes, setNotes] = useState(draft.notes)
  const [priceLabel, setPriceLabel] = useState(draft.priceLabel)
  const [gstNote, setGstNote] = useState(draft.gstNote)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const edit = (i, patch) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)))
  const move = (i, d) => setLines((ls) => { const a = [...ls]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a })
  const addLine = () => setLines((ls) => [...ls, { key: `c:${Date.now()}`, room: ls[ls.length - 1]?.room || '', text: '', details: '', on: true }])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await saveQuoteDraft(project.id, { lines: lines.filter((l) => l.text.trim()), notes, price_label: priceLabel, gst_note: gstNote })
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <section className="mb-4 space-y-3 rounded-xl border border-ink-100 bg-ink-50 p-3" aria-label="Quote wording">
      <p className="text-sm font-semibold text-ink-900">Quote wording</p>
      <p className="text-xs text-ink-600">Each line starts as one of your tasks. Reword it the way the client should read it, and add what is used in the detail line (for example the product and grade). Untick a line to leave it off the quote.</p>
      <div>
        <label htmlFor="qw-notes" className={labelClass}>Intro, inclusions and exclusions (optional)</label>
        <textarea id="qw-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </div>
      <ul className="space-y-2">
        {lines.map((l, i) => (
          <li key={l.key} className="rounded-lg border border-ink-100 bg-white p-2" data-testid={`qline-${i}`}>
            <div className="flex items-start gap-2">
              <input type="checkbox" checked={l.on !== false} onChange={(e) => edit(i, { on: e.target.checked })} className="mt-3 h-5 w-5 shrink-0" aria-label={`Include line ${i + 1}`} />
              <div className="min-w-0 flex-1 space-y-1.5">
                {l.room && <p className="text-xs font-semibold text-ink-600">{l.room}</p>}
                <input value={l.text} onChange={(e) => edit(i, { text: e.target.value })} className={inputClass} placeholder="What is done" aria-label={`Line ${i + 1} wording`} />
                <textarea rows={2} value={l.details} onChange={(e) => edit(i, { details: e.target.value })} className={`${inputClass} text-sm`} placeholder="Materials, brand, grade, finish…" aria-label={`Line ${i + 1} details`} />
              </div>
              <div className="flex shrink-0 flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="min-h-[36px] px-2 text-ink-600 disabled:opacity-30" aria-label={`Move line ${i + 1} up`}>▲</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === lines.length - 1} className="min-h-[36px] px-2 text-ink-600 disabled:opacity-30" aria-label={`Move line ${i + 1} down`}>▼</button>
                {String(l.key).startsWith('c:') && <button type="button" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))} className="min-h-[36px] px-2 text-lg leading-none text-ink-400" aria-label={`Remove line ${i + 1}`}>×</button>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <button type="button" onClick={addLine} className={secondary}>+ Add a line</button>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="qw-label" className={labelClass}>Price heading</label>
          <input id="qw-label" value={priceLabel} onChange={(e) => setPriceLabel(e.target.value)} placeholder="Total price (GST included)" className={inputClass} />
        </div>
        <div>
          <label htmlFor="qw-gst" className={labelClass}>GST line under the price</label>
          <input id="qw-gst" value={gstNote} onChange={(e) => setGstNote(e.target.value)} placeholder={autoGstNote(quote, fmtMoney)} className={inputClass} />
          <p className="mt-1 text-xs text-ink-600">Leave empty to use the line shown.</p>
        </div>
      </div>
      {error && <p className="text-sm text-status-blocked" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button onClick={save} disabled={busy} className={primary}>{busy ? 'Saving…' : 'Save wording'}</button>
        <button onClick={() => confirm('Start again from your task list? Your changes to the lines are lost.') && setLines(defaults)} className={secondary}>Reset lines to my tasks</button>
        <button onClick={onDone} className={secondary}>Cancel</button>
      </div>
    </section>
  )
}

// ---------- Payment schedule ----------

function MilestoneForm({ project, quote, milestone, onDone }) {
  const { addMilestone, updateMilestone } = useWork()
  const [name, setName] = useState(milestone?.name || '')
  const [mode, setMode] = useState('amount') // 'amount' | 'pct'
  const [amount, setAmount] = useState(milestone ? String(milestone.amount) : '')
  const [due, setDue] = useState(milestone?.due_on || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const value = mode === 'pct' ? amountFromPct(quote, amount) : amount

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const input = { name, amount: value ?? '', due_on: due }
      if (milestone) await updateMilestone(milestone.id, input)
      else await addMilestone(project.id, input)
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="mb-4 space-y-3 rounded-xl border border-ink-100 bg-ink-50 p-3" aria-label="Payment form">
      <p className="text-sm font-semibold text-ink-900">{milestone ? 'Edit payment' : 'Add a payment'}</p>
      <div>
        <label htmlFor="pm-name" className={labelClass}>Name</label>
        <input id="pm-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Deposit, Progress payment 1" className={inputClass} />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="pm-amount" className="text-sm font-medium text-ink-800">{mode === 'pct' ? 'Percent of the quote' : 'Amount ($, GST included)'}</label>
          {quote > 0 && (
            <div role="group" aria-label="Amount type" className="inline-flex gap-1 rounded-xl bg-ink-100 p-1">
              <button type="button" onClick={() => { setMode('amount'); setAmount('') }} aria-pressed={mode === 'amount'} className={seg(mode === 'amount')}>$</button>
              <button type="button" onClick={() => { setMode('pct'); setAmount('') }} aria-pressed={mode === 'pct'} className={seg(mode === 'pct')}>%</button>
            </div>
          )}
        </div>
        <input id="pm-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        {mode === 'pct' && value != null && <p className="mt-1 text-xs text-ink-600">= {fmtMoney(value)}</p>}
      </div>
      <div>
        <label htmlFor="pm-due" className={labelClass}>Due date (optional)</label>
        <input id="pm-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />
      </div>
      {error && <p className="text-sm text-status-blocked" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={primary}>{milestone ? 'Save changes' : 'Add payment'}</button>
        <button type="button" onClick={onDone} className={secondary}>Cancel</button>
      </div>
    </form>
  )
}

export default function QuoteTab({ project, quote }) {
  const { milestonesByProject, quoteError, paymentsByProject, addMilestones, deleteMilestone, receiveMilestone, undoReceive, quoteDrafts, roomsByProject, tasksByProject, materialsByTask } = useWork()
  const list = sortMilestones(milestonesByProject[project.id] || [])
  const payments = paymentsByProject[project.id] || []
  const [editing, setEditing] = useState(null) // 'new' | a milestone | null
  const [receiving, setReceiving] = useState(null) // { id, date }
  const [pdf, setPdf] = useState(false)
  const [wording, setWording] = useState(false)
  const [error, setError] = useState(null)
  const today = todayLocal()
  const t = scheduleTotals(list, quote)
  const defaults = useMemo(() => defaultLines(roomsByProject[project.id] || [], tasksByProject[project.id] || [], materialsByTask), [roomsByProject, tasksByProject, materialsByTask, project.id])
  const saved = quoteDrafts[project.id]
  const draft = { lines: mergeLines(saved?.lines, defaults), notes: saved?.notes || '', priceLabel: saved?.price_label || '', gstNote: saved?.gst_note || '' }

  async function act(fn) {
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
    }
  }

  if (quoteError) return <p className="text-sm text-status-blocked">{quoteError}</p>

  return (
    <div>
      <section className="mb-4 rounded-xl border border-ink-100 bg-white p-4" aria-label="Quote PDF">
        <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-600">Quote</h3>
        <p className="mt-1 text-sm text-ink-900">
          {quote > 0 ? <>Quote price <b>{fmtMoney(quote)}</b> (GST included)</> : 'No quote price yet. Set one on the project (Edit) to create a quote PDF.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setWording(true)} disabled={!(quote > 0) || wording} className={secondary}>Edit quote wording</button>
          <button onClick={() => setPdf(true)} disabled={!(quote > 0)} className={primary}>Create quote PDF</button>
        </div>
      </section>
      {wording && <QuoteEditor key={`${project.id}-${saved?.updated_at || 'new'}`} project={project} quote={quote} draft={draft} defaults={defaults} onDone={() => setWording(false)} />}

      <section aria-label="Payment schedule">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-600">Payment schedule</h3>
          {!editing && <button onClick={() => setEditing('new')} className={primary}>+ Add payment</button>}
        </div>

        {editing && <MilestoneForm key={editing === 'new' ? 'new' : editing.id} project={project} quote={quote} milestone={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}

        {list.length === 0 && !editing && (
          <div className="rounded-xl border border-dashed border-ink-200 p-4 text-center text-sm text-ink-600">
            <p>No payments scheduled yet.</p>
            {quote > 0 && (
              <button onClick={() => act(() => addMilestones(project.id, standardSplit(quote)))} className={`${secondary} mt-2`}>
                Start with deposit 20%, progress 40% and 30%, final 10%
              </button>
            )}
          </div>
        )}

        {list.length > 0 && (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="schedule-totals">
              <div className="rounded-xl border border-ink-100 bg-white p-3"><p className="text-xs text-ink-600">Scheduled</p><p className="font-semibold text-ink-900">{fmtMoney(t.scheduled)}</p></div>
              <div className="rounded-xl border border-ink-100 bg-white p-3"><p className="text-xs text-ink-600">Received</p><p className="font-semibold text-ink-900">{fmtMoney(t.received)}</p></div>
              <div className="rounded-xl border border-ink-100 bg-white p-3"><p className="text-xs text-ink-600">Still to come</p><p className="font-semibold text-ink-900">{fmtMoney(t.toCome)}</p></div>
              {t.unscheduled != null && (
                <div className="rounded-xl border border-ink-100 bg-white p-3">
                  <p className="text-xs text-ink-600">{t.unscheduled < 0 ? 'Over the quote by' : 'Not yet scheduled'}</p>
                  <p className={`font-semibold ${t.unscheduled !== 0 ? 'text-[#7A4B05]' : 'text-ink-900'}`}>{fmtMoney(Math.abs(t.unscheduled))}</p>
                </div>
              )}
            </div>
            <ul className="space-y-2">
              {list.map((m) => {
                const st = milestoneState(m, today)
                const pay = payments.find((p) => p.id === m.payment_id)
                const label = st.kind === 'received' ? `Received ${fmtDate(pay?.received_on) || ''}`.trim() : st.kind === 'overdue' ? `Overdue ${st.days} day${st.days === 1 ? '' : 's'}` : st.kind === 'due' ? (st.days === 0 ? 'Due today' : `Due in ${st.days} day${st.days === 1 ? '' : 's'}`) : 'No due date'
                const tone = st.kind === 'received' ? 'bg-[#D7EBDD] text-[#1F5A37]' : st.kind === 'overdue' ? 'bg-[#F6DAD4] text-[#7A2A1D]' : 'bg-ink-100 text-ink-800'
                return (
                  <li key={m.id} className="rounded-xl border border-ink-100 bg-white p-3" data-testid={`milestone-${m.name}`}>
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => !m.payment_id && setEditing(m)} className="min-w-0 flex-1 text-left" aria-label={`Edit ${m.name}`}>
                        <p className="text-sm font-semibold text-ink-900">{m.name}</p>
                        <p className="text-xs text-ink-600">{m.due_on ? `Due ${fmtDate(m.due_on)}` : 'No due date'}</p>
                      </button>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <p className="font-semibold text-ink-900">{fmtMoney(m.amount)}</p>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {m.payment_id ? (
                        <button onClick={() => confirm(`Undo "${m.name}"? The payment it recorded is removed from Cash flow.`) && act(() => undoReceive(m))} className={small}>Undo received</button>
                      ) : receiving?.id === m.id ? (
                        <>
                          <input type="date" value={receiving.date} onChange={(e) => setReceiving({ id: m.id, date: e.target.value })} aria-label={`Received on for ${m.name}`} className="min-h-[40px] rounded-lg border border-ink-200 px-2 text-sm" />
                          <button onClick={() => act(async () => { await receiveMilestone(m, receiving.date); setReceiving(null) })} className="min-h-[40px] rounded-lg bg-ink-900 px-3 text-xs font-semibold text-white">Confirm</button>
                          <button onClick={() => setReceiving(null)} className={small}>Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => setReceiving({ id: m.id, date: today })} className="min-h-[40px] rounded-lg bg-ink-900 px-3 text-xs font-semibold text-white" aria-label={`Mark ${m.name} received`}>Mark received</button>
                      )}
                      {!m.payment_id && <button onClick={() => confirm(`Delete "${m.name}"?`) && act(() => deleteMilestone(m.id))} className="min-h-[40px] px-2 text-xs font-medium text-ink-400 underline" aria-label={`Delete ${m.name}`}>Delete</button>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        {error && <p className="mt-2 text-sm text-status-blocked" role="alert">{error}</p>}
      </section>
      {pdf && <QuoteDialog project={project} quote={quote} milestones={list} draft={draft} onEditWording={() => { setPdf(false); setWording(true) }} onClose={() => setPdf(false)} />}
    </div>
  )
}
