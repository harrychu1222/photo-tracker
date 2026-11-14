import { useState } from 'react'
import { PROJECT_STATUSES } from '../../statusConfig'
import { useWork } from '../../context/WorkContext'
import { ESTIMATE_LINES, targetOf } from '../../lib/expenses'
import { estimatesFromPlan, taskPlannedSpan, actualSpan } from '../../lib/quote'
import { fmtMoney } from '../../lib/format'
import { todayLocal } from '../../lib/tasks'

const inputClass =
  'w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-base focus:border-signal-500'
const labelClass = 'mb-1 block text-sm font-medium text-ink-800'

// Create (project = null) or edit a project. Money fields only appear for admins.
export default function ProjectForm({
  project,
  finance,
  isAdmin,
  canDelete,
  onSave,
  onDelete,
  onCancel
}) {
  const [name, setName] = useState(project?.name || '')
  const [client, setClient] = useState(project?.client || '')
  const [siteAddress, setSiteAddress] = useState(project?.site_address || '')
  const [status, setStatus] = useState(project?.status || 'active')
  const [startDate, setStartDate] = useState(project?.start_date || '')
  const [endDate, setEndDate] = useState(project?.end_date || '')
  const [actualStart, setActualStart] = useState(project?.actual_start || '')
  const [actualEnd, setActualEnd] = useState(project?.actual_end || '')
  const { tasksByProject, materialsByTask, equipmentByTask, matPrices, eqPrices, rateBook } = useWork()
  const tasks = project ? tasksByProject[project.id] || [] : []
  const [notes, setNotes] = useState(project?.notes || '')

  const [mode, setMode] = useState(finance?.quote_mode === 'lump' ? 'lump' : 'buildup')
  const [budget, setBudget] = useState(finance?.budget ?? '')
  const [markup, setMarkup] = useState(finance?.markup_pct ?? 0)
  const [quoteLump, setQuoteLump] = useState(finance?.quote_lump ?? '')
  const [est, setEst] = useState(Object.fromEntries(ESTIMATE_LINES.map((l) => [l.key, finance?.[l.key] ?? ''])))
  const [fillNote, setFillNote] = useState(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const estNumbers = ESTIMATE_LINES.map((l) => est[l.key]).filter((v) => v !== '' && Number.isFinite(Number(v)))
  const estSum = estNumbers.reduce((s, v) => s + Number(v), 0)
  // Build-up: the target is the sum of the estimates (an older typed-in target stays until one is filled in).
  const moneyBudget = mode === 'buildup' && estNumbers.length > 0 ? Math.round(estSum * 100) / 100 : budget
  const previewTarget = targetOf({ quote_mode: mode, budget, ...est })
  const previewQuote =
    mode === 'lump'
      ? Number(quoteLump) > 0
        ? Number(quoteLump)
        : null
      : previewTarget > 0
        ? Math.round(previewTarget * (1 + Number(markup || 0) / 100) * 100) / 100
        : null

  function pickStatus(value) {
    setStatus(value)
    // Marking the project complete fills in the actual end date (still editable).
    if (value === 'complete' && !actualEnd) {
      const done = actualSpan({ ...project, status: value, actual_end: null }, tasks).end
      setActualEnd(done || todayLocal())
    }
  }

  function fillFromPlan() {
    const plan = estimatesFromPlan(tasks, materialsByTask, equipmentByTask, matPrices, eqPrices, rateBook)
    setEst((cur) => ({
      ...cur,
      est_materials: String(plan.materials),
      est_equipment: String(plan.equipment),
      est_labour: plan.labour != null ? String(plan.labour) : cur.est_labour
    }))
    setFillNote(
      plan.labour != null
        ? `Filled from the task plan. Labour is ${plan.hours} planned hours at the average usual rate of ${fmtMoney(plan.rate)}/h.`
        : 'Materials and equipment filled from the task plan. Labour was left alone: set usual hourly rates on the Labour tab and add planned hours to tasks to fill it too.'
    )
  }

  function useTaskDates() {
    const span = taskPlannedSpan(tasks)
    if (!span.start && !span.end) return setFillNote('No task has planned dates yet.')
    if (span.start) setStartDate(span.start)
    if (span.end) setEndDate(span.end)
    setFillNote(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Give the project a name.')
      return
    }
    if (startDate && endDate && endDate < startDate) {
      setError('The planned end date is before the planned start date.')
      return
    }
    if (actualStart && actualEnd && actualEnd < actualStart) {
      setError('The actual end date is before the actual start date.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSave(
        {
          name,
          client: client.trim(),
          site_address: siteAddress.trim(),
          status,
          start_date: startDate || null,
          end_date: endDate || null,
          actual_start: actualStart || null,
          actual_end: actualEnd || null,
          notes: notes.trim() || null
        },
        isAdmin ? { quote_mode: mode, budget: moneyBudget, markup_pct: markup, quote_lump: quoteLump, ...est } : null
      )
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Delete "${project.name}"? Its photos are kept, they just won't be linked to a project any more. This cannot be undone.`
      )
    )
      return
    try {
      await onDelete()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={onCancel} className="text-sm font-medium text-ink-600">
          ← Back
        </button>
        <h2 className="text-lg font-semibold text-ink-900">{project ? 'Edit project' : 'New project'}</h2>
        <span className="w-12" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Project name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Smith kitchen" />
        </div>

        <div>
          <label className={labelClass}>Client</label>
          <input value={client} onChange={(e) => setClient(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Site address</label>
          <input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Status</label>
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_STATUSES.map((s) => (
              <button
                type="button"
                key={s.value}
                onClick={() => pickStatus(s.value)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  status === s.value ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
                }`}
              >
                <span className="status-dot" style={{ backgroundColor: s.color }} />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="rounded-xl border border-ink-100 p-3">
          <legend className="px-1 text-sm font-semibold text-ink-800">Dates</legend>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Planned start</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} aria-label="Planned start" />
            </div>
            <div>
              <label className={labelClass}>Planned end</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} aria-label="Planned end" />
            </div>
            <div>
              <label className={labelClass}>Actual start</label>
              <input type="date" value={actualStart} onChange={(e) => setActualStart(e.target.value)} className={inputClass} aria-label="Actual start" />
            </div>
            <div>
              <label className={labelClass}>Actual end</label>
              <input type="date" value={actualEnd} onChange={(e) => setActualEnd(e.target.value)} className={inputClass} aria-label="Actual end" />
            </div>
          </div>
          <p className="mt-2 text-xs text-ink-600">
            Actual dates fill in on their own when the first task starts and when you mark the project Complete. You can change them here.
          </p>
          {project && (
            <button type="button" onClick={useTaskDates} className="mt-2 rounded-full border border-ink-200 px-3 py-1 text-xs font-medium text-ink-600">
              Use task dates for the planned dates
            </button>
          )}
        </fieldset>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass} />
        </div>

        {isAdmin && (
          <fieldset className="rounded-xl border border-ink-100 bg-ink-50 p-4">
            <legend className="px-1 text-sm font-semibold text-ink-800">Quote (admins only)</legend>
            <p className="mb-3 text-xs text-ink-600">Enter every amount as paid, GST included. The quote price is the final amount the client pays.</p>
            <div className="mb-3 flex gap-1.5" role="group" aria-label="Quote type">
              {[
                { v: 'buildup', l: 'Build up from estimates' },
                { v: 'lump', l: 'Lump sum' }
              ].map((m) => (
                <button
                  type="button"
                  key={m.v}
                  onClick={() => setMode(m.v)}
                  aria-pressed={mode === m.v}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${mode === m.v ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'}`}
                >
                  {m.l}
                </button>
              ))}
            </div>

            {mode === 'buildup' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {ESTIMATE_LINES.map((l) => (
                    <div key={l.key}>
                      <label className={labelClass}>Estimated {l.label.toLowerCase()}</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={est[l.key]}
                        onChange={(e) => setEst({ ...est, [l.key]: e.target.value })}
                        className={inputClass}
                        placeholder="$"
                        aria-label={`Estimated ${l.label.toLowerCase()}`}
                      />
                    </div>
                  ))}
                </div>
                {project && (
                  <button type="button" onClick={fillFromPlan} className="rounded-full border border-ink-200 px-3 py-1 text-xs font-medium text-ink-600">
                    Fill from task plan
                  </button>
                )}
                {fillNote && <p className="text-xs text-ink-600">{fillNote}</p>}
                {estNumbers.length === 0 && Number(budget) > 0 && (
                  <p className="text-xs text-ink-600">
                    An earlier target cost of {fmtMoney(budget)} is still in use. Fill in the estimates above to replace it.
                  </p>
                )}
                <div>
                  <label className={labelClass}>Markup (%)</label>
                  <input type="number" inputMode="decimal" min="0" step="0.1" value={markup} onChange={(e) => setMarkup(e.target.value)} className={inputClass} aria-label="Markup percent" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Quote price</label>
                  <input type="number" inputMode="decimal" min="0" step="0.01" value={quoteLump} onChange={(e) => setQuoteLump(e.target.value)} className={inputClass} placeholder="$ final price to the client" aria-label="Quote price" />
                </div>
                <div>
                  <label className={labelClass}>Target cost (internal ceiling, optional)</label>
                  <input type="number" inputMode="decimal" min="0" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} className={inputClass} placeholder="$" aria-label="Target cost" />
                </div>
              </div>
            )}

            <dl className="mt-3 space-y-1 border-t border-ink-100 pt-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-600">Target cost</dt>
                <dd className="text-ink-900" data-testid="form-target">{previewTarget > 0 ? fmtMoney(previewTarget) : '—'}</dd>
              </div>
              <div className="flex justify-between font-semibold">
                <dt className="text-ink-800">Quote price</dt>
                <dd className="text-ink-900" data-testid="form-quote">{previewQuote != null ? fmtMoney(previewQuote) : '—'}</dd>
              </div>
              {previewQuote != null && previewTarget > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-600">Expected margin</dt>
                  <dd className="text-ink-900">{fmtMoney(previewQuote - previewTarget)}</dd>
                </div>
              )}
            </dl>
          </fieldset>
        )}

        {error && <p className="text-sm text-status-blocked">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-signal-500 py-3 text-base font-medium text-ink-950 disabled:opacity-60"
        >
          {saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}
        </button>

        {project && canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="w-full rounded-lg border border-status-blocked py-2.5 text-sm font-medium text-status-blocked"
          >
            Delete project
          </button>
        )}
      </form>
    </div>
  )
}
