import { useState } from 'react'
import { useWork } from '../../context/WorkContext'
import { materialDatePatch, materialDatesText, materialLateDays } from '../../lib/materials'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm focus:border-signal-500'

// The ordered / expected / delivered dates of one material: a line of text you can tap to edit.
export default function MaterialDates({ material }) {
  const { setMaterialStatus } = useWork()
  const [editing, setEditing] = useState(false)
  const [ordered, setOrdered] = useState(material.ordered_on || '')
  const [expected, setExpected] = useState(material.expected_on || '')
  const [delivered, setDelivered] = useState(material.delivered_on || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const text = materialDatesText(material)
  const lateDays = materialLateDays(material)

  function open() {
    setOrdered(material.ordered_on || '')
    setExpected(material.expected_on || '')
    setDelivered(material.delivered_on || '')
    setError(null)
    setEditing(true)
  }

  async function save() {
    if (ordered && delivered && delivered < ordered) return setError('Delivered is before ordered.')
    setBusy(true)
    setError(null)
    try {
      await setMaterialStatus(
        material.id,
        materialDatePatch(material, { ordered_on: ordered, expected_on: expected, delivered_on: delivered })
      )
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <div className="mt-1.5 space-y-2 rounded-lg bg-ink-50 p-2.5">
        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-ink-600">
            Ordered
            <input type="date" value={ordered} onChange={(e) => setOrdered(e.target.value)} className={inputClass} aria-label="Ordered on" />
          </label>
          <label className="text-xs text-ink-600">
            Expected
            <input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} className={inputClass} aria-label="Expected delivery" />
          </label>
          <label className="text-xs text-ink-600">
            Delivered
            <input type="date" value={delivered} onChange={(e) => setDelivered(e.target.value)} className={inputClass} aria-label="Delivered on" />
          </label>
        </div>
        <p className="text-xs text-ink-400">The status follows the dates: a delivered date marks it Delivered, an ordered date marks it Ordered.</p>
        {error && <p className="text-xs text-status-blocked">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
            Save dates
          </button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <p className="mt-0.5 text-xs text-ink-600">
      <button type="button" onClick={open} className="text-left underline decoration-dotted underline-offset-2" aria-label="Edit dates">
        {text || 'Add dates'}
      </button>
      {lateDays != null && (
        <span className="ml-2 font-medium text-status-blocked">
          Late by {lateDays} day{lateDays === 1 ? '' : 's'}
        </span>
      )}
      {error && <span className="ml-2 text-status-blocked">{error}</span>}
    </p>
  )
}
