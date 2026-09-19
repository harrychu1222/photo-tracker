import { useRef, useState } from 'react'
import TagInput from './TagInput'
import { STATUSES } from '../../statusConfig'

export default function UploadModal({ onClose, onUpload }) {
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('progress')
  const [tags, setTags] = useState([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) {
      setError('Choose or take a photo first.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onUpload({ file, location, category, status, tags, notes })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-app overflow-y-auto rounded-t-2xl bg-white p-5 pb-8 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">Add photo</h2>
          <button onClick={onClose} className="text-2xl leading-none text-ink-400" aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            {preview ? (
              <img src={preview} alt="Selected preview" className="mb-2 h-48 w-full rounded-lg object-cover" />
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg border border-dashed border-ink-200 py-3 text-sm font-medium text-ink-600"
            >
              {file ? 'Choose a different photo' : 'Take or choose a photo'}
            </button>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-800">Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Site A — Room 3"
              className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-base focus:border-signal-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-800">Category of work</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Electrical"
              className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-base focus:border-signal-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-800">Progress status</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
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

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-800">Tags</label>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-800">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-base focus:border-signal-500"
            />
          </div>

          {error && <p className="text-sm text-status-blocked">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-signal-500 py-3 text-base font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Uploading…' : 'Save photo'}
          </button>
        </form>
      </div>
    </div>
  )
}
