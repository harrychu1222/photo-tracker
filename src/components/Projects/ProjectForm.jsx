import { useState } from 'react'
import { PROJECT_STATUSES } from '../../statusConfig'

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
  const [notes, setNotes] = useState(project?.notes || '')

  const [budget, setBudget] = useState(finance?.budget ?? '')
  const [markup, setMarkup] = useState(finance?.markup_pct ?? 0)
  const [gst, setGst] = useState(finance?.gst_enabled ?? true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Give the project a name.')
      return
    }
    if (startDate && endDate && endDate < startDate) {
      setError('The end date is before the start date.')
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
          notes: notes.trim() || null
        },
        isAdmin ? { budget, markup_pct: markup, gst_enabled: gst } : null
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
                onClick={() => setStatus(s.value)}
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>End date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass} />
        </div>

        {isAdmin && (
          <fieldset className="rounded-xl border border-ink-100 bg-ink-50 p-4">
            <legend className="px-1 text-sm font-semibold text-ink-800">Money (admins only)</legend>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Target cost (internal ceiling, optional)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className={inputClass}
                  placeholder="AUD"
                />
              </div>
              <div>
                <label className={labelClass}>Markup (%)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={markup}
                  onChange={(e) => setMarkup(e.target.value)}
                  className={inputClass}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink-800">
                <input type="checkbox" checked={gst} onChange={(e) => setGst(e.target.checked)} />
                Add 10% GST to the quote total
              </label>
            </div>
          </fieldset>
        )}

        {error && <p className="text-sm text-status-blocked">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-signal-500 py-3 text-base font-medium text-white disabled:opacity-60"
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
