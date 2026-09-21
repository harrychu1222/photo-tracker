import { useRef, useState } from 'react'
import TagInput from './TagInput'
import AddressAutocomplete from './AddressAutocomplete'
import SuggestInput from './SuggestInput'
import { STATUSES, QUOTING_STATUSES } from '../../statusConfig'

export default function UploadModal({ onClose, onUpload, suggestions = {} }) {
  const fileInputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [location, setLocation] = useState('')
  const [room, setRoom] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('progress')
  const [quotingStatus, setQuotingStatus] = useState('')
  const [tags, setTags] = useState([])
  const [notes, setNotes] = useState('')

  // 'none' | 'gps' | 'address'
  const [locationMode, setLocationMode] = useState('none')
  const [coords, setCoords] = useState(null)
  const [addressText, setAddressText] = useState('')
  const [addressCoords, setAddressCoords] = useState(null) // set once a suggestion is picked
  const [locating, setLocating] = useState(false)

  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(null) // { done, total }

  function handleFiles(e) {
    const list = Array.from(e.target.files || [])
    if (!list.length) return
    setFiles(list)
    setPreviews(list.map((f) => URL.createObjectURL(f)))
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  function handleLocationMode(mode) {
    setLocationMode(mode)
    setError(null)
    if (mode !== 'gps') return

    if (!navigator.geolocation) {
      setError('Location is not available on this device/browser.')
      setLocationMode('none')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        setError('Could not get your location. Check location permissions.')
        setLocationMode('none')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function resolveCoords() {
    if (locationMode === 'gps') return coords ?? { lat: undefined, lng: undefined }

    if (locationMode === 'address') {
      if (addressCoords) return addressCoords // a suggestion was picked — already geocoded
      const typed = addressText.trim()
      if (!typed) return { lat: undefined, lng: undefined }
      // They typed an address but never picked a suggestion — try once to
      // resolve it anyway so it can still show up on the map.
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(typed)}`
        )
        const results = await res.json()
        if (results[0]) return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) }
      } catch {
        // Non-blocking — the photo still saves, it just won't have a map pin.
      }
      return { lat: undefined, lng: undefined }
    }

    return { lat: undefined, lng: undefined }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!files.length) {
      setError('Choose at least one photo first.')
      return
    }

    setError(null)
    setSaving(true)
    setProgress(files.length > 1 ? { done: 0, total: files.length } : null)

    const { lat, lng } = await resolveCoords()

    try {
      await onUpload({
        files,
        location,
        room,
        category,
        status,
        quotingStatus,
        tags,
        notes,
        lat,
        lng,
        onProgress: (done, total) => setProgress({ done, total })
      })
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
          <h2 className="text-lg font-semibold text-ink-900">Add photos</h2>
          <button onClick={onClose} className="text-2xl leading-none text-ink-400" aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            {previews.length > 0 && (
              <div className="mb-2 grid grid-cols-4 gap-1.5">
                {previews.map((src, i) => (
                  <div key={src} className="relative aspect-square overflow-hidden rounded-lg">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* No `capture` attribute — lets the picker offer Photo Library as
                well as the camera. `multiple` enables bulk selection/upload. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFiles}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-lg border border-dashed border-ink-200 py-3 text-sm font-medium text-ink-600"
            >
              {files.length
                ? `${files.length} photo${files.length > 1 ? 's' : ''} selected — tap to change`
                : 'Choose or take photos (you can select several)'}
            </button>
            {files.length > 1 && (
              <p className="mt-1.5 text-xs text-ink-400">
                The details below will be applied to all {files.length} photos.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-800">Project</label>
            <SuggestInput
              value={location}
              onChange={setLocation}
              options={suggestions.locations || []}
              placeholder="e.g. Site A"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-800">Room</label>
            <SuggestInput
              value={room}
              onChange={setRoom}
              options={suggestions.rooms || []}
              placeholder="e.g. Room 3 / Kitchen"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-800">Category of work</label>
            <SuggestInput
              value={category}
              onChange={setCategory}
              options={suggestions.categories || []}
              placeholder="e.g. Electrical"
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
            <label className="mb-1 block text-sm font-medium text-ink-800">Quoting status (optional)</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setQuotingStatus('')}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  quotingStatus === '' ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
                }`}
              >
                None
              </button>
              {QUOTING_STATUSES.map((s) => (
                <button
                  type="button"
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
            <label className="mb-1 block text-sm font-medium text-ink-800">Map location (optional)</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleLocationMode('none')}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  locationMode === 'none' ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
                }`}
              >
                None
              </button>
              <button
                type="button"
                onClick={() => handleLocationMode('gps')}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  locationMode === 'gps' ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
                }`}
              >
                {locating ? 'Getting GPS…' : coords && locationMode === 'gps' ? 'Current GPS ✓' : 'Use current GPS'}
              </button>
              <button
                type="button"
                onClick={() => handleLocationMode('address')}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  locationMode === 'address' ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
                }`}
              >
                Search address
              </button>
            </div>

            {locationMode === 'address' && (
              <div className="mt-2">
                <AddressAutocomplete
                  value={addressText}
                  onChange={(text) => {
                    setAddressText(text)
                    setAddressCoords(null) // typing invalidates a previously picked suggestion
                  }}
                  onSelect={({ address, lat, lng }) => {
                    setAddressText(address)
                    setAddressCoords({ lat, lng })
                  }}
                />
                <p className="mt-1 text-xs text-ink-400">
                  {addressCoords
                    ? 'Address selected ✓'
                    : "Pick a suggestion, or just leave your typed address — we'll try to place it on the map."}
                </p>
              </div>
            )}
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

          {progress && (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full bg-signal-500 transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-ink-500">
                Uploading {progress.done} of {progress.total}…
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-signal-500 py-3 text-base font-medium text-white disabled:opacity-60"
          >
            {saving
              ? 'Uploading…'
              : files.length > 1
              ? `Save ${files.length} photos`
              : 'Save photo'}
          </button>
        </form>
      </div>
    </div>
  )
}
