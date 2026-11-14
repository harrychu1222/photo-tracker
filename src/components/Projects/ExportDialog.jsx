import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { allProjectsCsvFiles, EXPORT_FILES, fyRange, projectCsvFiles } from '../../lib/exports'
import { makeZip } from '../../lib/zip'
import { slug } from '../../lib/csv'
import { todayLocal } from '../../lib/tasks'

const inputClass = 'rounded-lg border border-ink-200 bg-white px-3 py-2 text-base focus:border-signal-500'

function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Export CSV files for one project, or (when `projects` has several) for all of them.
export default function ExportDialog({ projects, snaps, onClose }) {
  const { isAdmin } = useAuth()
  const work = useWork()
  const today = todayLocal()
  const files = EXPORT_FILES.filter((f) => isAdmin || !f.money)
  const [keys, setKeys] = useState(files.map((f) => f.key))
  const [preset, setPreset] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [zip, setZip] = useState(true)
  const [note, setNote] = useState(null)
  const [error, setError] = useState(null)
  const many = projects.length > 1
  const hasRanged = files.some((f) => f.ranged && keys.includes(f.key))
  const range = preset === 'fy' ? fyRange(today) : preset === 'lastfy' ? fyRange(today, 1) : preset === 'custom' ? { from, to } : null

  const toggle = (k) => setKeys((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]))

  function run() {
    setError(null)
    setNote(null)
    try {
      const chosen = EXPORT_FILES.filter((f) => keys.includes(f.key) && (isAdmin || !f.money)).map((f) => f.key)
      if (!chosen.length && !(many && isAdmin)) throw new Error('Tick at least one file.')
      const opts = { isAdmin, range }
      const out = many ? allProjectsCsvFiles(projects, work, chosen, opts, snaps) : projectCsvFiles(projects[0], work, chosen, opts)
      if (!out.length) throw new Error('Nothing to export.')
      const day = today
      if (zip && out.length > 1) {
        const bytes = makeZip(out.map((f) => ({ name: f.name, text: f.text })))
        download(new Blob([bytes], { type: 'application/zip' }), `${many ? 'all-projects' : slug(projects[0].name)}-export-${day}.zip`)
      } else {
        out.forEach((f, i) => setTimeout(() => download(new Blob([f.text], { type: 'text/csv;charset=utf-8' }), f.name), i * 250))
      }
      setNote(`Exported ${out.length} file${out.length === 1 ? '' : 's'}: ${out.map((f) => `${f.name.replace(/-\d{4}-\d{2}-\d{2}\.csv$/, '')} (${f.count} rows)`).join(', ')}.`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-label="Export" data-testid="export-dialog">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-md sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink-900">{many ? 'Export all projects' : `Export ${projects[0].name}`}</h3>
          <button onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 items-center justify-center text-2xl leading-none text-ink-400">×</button>
        </div>
        <p className="mb-3 text-sm text-ink-600">Spreadsheet (CSV) files that open in Excel or Numbers. Dates are dd/mm/yyyy; amounts are GST-included cash.</p>
        <fieldset className="mb-3">
          <legend className="mb-1 text-sm font-semibold text-ink-800">Files</legend>
          {files.map((f) => (
            <label key={f.key} className="flex min-h-[44px] items-center gap-3 text-sm text-ink-900">
              <input type="checkbox" checked={keys.includes(f.key)} onChange={() => toggle(f.key)} className="h-5 w-5" /> {f.label}
            </label>
          ))}
        </fieldset>
        {hasRanged && (
          <div className="mb-3">
            <label htmlFor="ex-range" className="mb-1 block text-sm font-semibold text-ink-800">Dates for expenses, payments and labour</label>
            <select id="ex-range" value={preset} onChange={(e) => setPreset(e.target.value)} className={`${inputClass} w-full`}>
              <option value="all">All time</option>
              <option value="fy">This financial year (1 Jul – 30 Jun)</option>
              <option value="lastfy">Last financial year</option>
              <option value="custom">Custom dates</option>
            </select>
            {preset === 'custom' && (
              <div className="mt-2 flex gap-2">
                <input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} flex-1`} />
                <input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} flex-1`} />
              </div>
            )}
          </div>
        )}
        <label className="mb-3 flex min-h-[44px] items-center gap-3 text-sm text-ink-900">
          <input type="checkbox" checked={zip} onChange={(e) => setZip(e.target.checked)} className="h-5 w-5" /> Put the files in one zip
        </label>
        {error && <p className="mb-2 text-sm text-status-blocked" role="alert">{error}</p>}
        {note && <p className="mb-2 text-sm text-ink-800" role="status">{note}</p>}
        <div className="flex gap-2">
          <button onClick={run} className="min-h-[44px] rounded-lg bg-signal-500 px-5 text-sm font-semibold text-ink-950">Export</button>
          <button onClick={onClose} className="min-h-[44px] rounded-lg border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-900">Close</button>
        </div>
      </div>
    </div>
  )
}
