import { useState } from 'react'
import TagInput from './TagInput'
import SuggestInput from './SuggestInput'
import { STATUSES, QUOTING_STATUSES, quotingStatusMeta } from '../../statusConfig'
import { useAuth } from '../../context/AuthContext'

export default function PhotoDetail({ photo, onClose, onUpdate, onDelete, suggestions = {} }) {
  const { user } = useAuth()
  const isOwner = user?.id === photo.user_id
  const [editing, setEditing] = useState(false)
  const [location, setLocation] = useState(photo.location)
  const [room, setRoom] = useState(photo.room || '')
  const [category, setCategory] = useState(photo.category)
  const [status, setStatus] = useState(photo.status)
  const [quotingStatus, setQuotingStatus] = useState(photo.quoting_status || '')
  const [tags, setTags] = useState(photo.tags)
  const [notes, setNotes] = useState(photo.notes || '')
  const [saving, setSaving] = useState(false)

  const qMeta = quotingStatusMeta(photo.quoting_status)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (!photo.url) return
    setDownloading(true)
    try {
      const res = await fetch(photo.url)
      const blob = await res.blob()
      const ext = photo.storage_path.split('.').pop() || 'jpg'
      const namePart = [photo.location, photo.room].filter(Boolean).join('-').replace(/\s+/g, '_') || 'photo'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${namePart}-${photo.id.slice(0, 8)}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onUpdate(photo.id, {
        location,
        room,
        category,
        status,
        quoting_status: quotingStatus || null,
        tags,
        notes: notes || null
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this photo? This cannot be undone.')) return
    await onDelete(photo)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-app overflow-y-auto rounded-t-2xl bg-white p-5 pb-8 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">Photo details</h2>
          <button onClick={onClose} className="text-2xl leading-none text-ink-400" aria-label="Close">
            ×
          </button>
        </div>

        {photo.url && (
          <img src={photo.url} alt={photo.location} className="mb-2 h-56 w-full rounded-lg object-cover" />
        )}

        <button
          onClick={handleDownload}
          disabled={downloading || !photo.url}
          className="mb-4 w-full rounded-lg border border-ink-200 py-2 text-sm font-medium text-ink-600 disabled:opacity-60"
        >
          {downloading ? 'Downloading…' : 'Download photo'}
        </button>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Project</label>
              <SuggestInput value={location} onChange={setLocation} options={suggestions.locations || []} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Room</label>
              <SuggestInput value={room} onChange={setRoom} options={suggestions.rooms || []} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Category of work</label>
              <SuggestInput value={category} onChange={setCategory} options={suggestions.categories || []} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Progress status</label>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <button
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
              <label className="mb-1 block text-sm font-medium text-ink-800">Quoting status</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setQuotingStatus('')}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    quotingStatus === '' ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
                  }`}
                >
                  None
                </button>
                {QUOTING_STATUSES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setQuotingStatus(s.value)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                      quotingStatus === s.value ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
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
              <label className="mb-1 block text-sm font-medium text-ink-800">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-base focus:border-signal-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 rounded-lg border border-ink-200 py-2.5 text-sm font-medium text-ink-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-signal-500 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-400">Project</p>
              <p className="text-base text-ink-900">{photo.location || '—'}</p>
            </div>
            {photo.room && (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-400">Room</p>
                <p className="text-base text-ink-900">{photo.room}</p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wide text-ink-400">Category</p>
              <p className="text-base text-ink-900">{photo.category || '—'}</p>
            </div>
            {qMeta && (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-400">Quoting status</p>
                <p className="flex items-center gap-1.5 text-base text-ink-900">
                  <span className="status-dot" style={{ backgroundColor: qMeta.color }} />
                  {qMeta.label}
                </p>
              </div>
            )}
            {photo.notes && (
              <div>
                <p className="text-xs uppercase tracking-wide text-ink-400">Notes</p>
                <p className="text-base text-ink-900">{photo.notes}</p>
              </div>
            )}
            {photo.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {photo.tags.map((t) => (
                  <span key={t} className="rounded-full bg-ink-100 px-2.5 py-1 text-xs text-ink-800">
                    #{t}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-ink-400">
              Taken {new Date(photo.taken_at || photo.created_at).toLocaleString()}
              {photo.taken_at && ` · Added ${new Date(photo.created_at).toLocaleDateString()}`}
            </p>

            {isOwner && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 rounded-lg border border-ink-200 py-2.5 text-sm font-medium text-ink-600"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 rounded-lg border border-status-blocked py-2.5 text-sm font-medium text-status-blocked"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
