import { useMemo, useState } from 'react'
import FilterBar from './FilterBar'
import PhotoCard from './PhotoCard'
import PhotoDetail from './PhotoDetail'
import MapView from './MapView'
import TimelineView from './TimelineView'
import CompareView from './CompareView'

const emptyFilters = { search: '', location: '', room: '', category: '', tag: '', status: null, quotingStatus: null }

export default function Gallery({ photos, loading, error, onUpdate, onDelete }) {
  const [filters, setFilters] = useState(emptyFilters)
  const [openPhoto, setOpenPhoto] = useState(null)
  const [view, setView] = useState('gallery') // 'gallery' | 'map'
  const [compareMode, setCompareMode] = useState(false)
  const [selected, setSelected] = useState([])
  const [comparing, setComparing] = useState(false)

  const options = useMemo(() => {
    const uniq = (values) => Array.from(new Set(values.filter(Boolean))).sort()
    return {
      locations: uniq(photos.map((p) => p.location)),
      rooms: uniq(photos.map((p) => p.room)),
      categories: uniq(photos.map((p) => p.category)),
      tags: uniq(photos.flatMap((p) => p.tags || []))
    }
  }, [photos])

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return photos.filter((p) => {
      if (filters.status && p.status !== filters.status) return false
      if (filters.quotingStatus && p.quoting_status !== filters.quotingStatus) return false
      if (filters.location && p.location !== filters.location) return false
      if (filters.room && p.room !== filters.room) return false
      if (filters.category && p.category !== filters.category) return false
      if (filters.tag && !(p.tags || []).includes(filters.tag)) return false
      if (
        q &&
        !(
          p.location?.toLowerCase().includes(q) ||
          p.room?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
        )
      )
        return false
      return true
    })
  }, [photos, filters])

  function toggleCompareMode() {
    setCompareMode((m) => !m)
    setSelected([])
  }

  function toggleSelect(photo) {
    setSelected((prev) => {
      const exists = prev.find((p) => p.id === photo.id)
      if (exists) return prev.filter((p) => p.id !== photo.id)
      if (prev.length >= 2) return [prev[1], photo] // keep the two most recent picks
      return [...prev, photo]
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2">
        <div className="flex gap-1.5">
          <button
            onClick={() => setView('gallery')}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              view === 'gallery' ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
            }`}
          >
            Gallery
          </button>
          <button
            onClick={() => setView('map')}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              view === 'map' ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
            }`}
          >
            Map
          </button>
          <button
            onClick={() => setView('timeline')}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              view === 'timeline' ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-600'
            }`}
          >
            Timeline
          </button>
        </div>

        {view === 'gallery' && (
          <button
            onClick={toggleCompareMode}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              compareMode ? 'border-signal-500 bg-signal-100 text-signal-600' : 'border-ink-200 text-ink-600'
            }`}
          >
            {compareMode ? 'Cancel compare' : 'Compare'}
          </button>
        )}
      </div>

      {view !== 'timeline' && <FilterBar filters={filters} onChange={setFilters} options={options} />}

      {view === 'map' && <MapView photos={filtered} onOpen={setOpenPhoto} />}

      {view === 'timeline' && <TimelineView photos={photos} options={options} onOpen={setOpenPhoto} />}

      {view === 'gallery' && (
        <div className="px-4 py-4 pb-24">
          {loading && <p className="py-10 text-center text-sm text-ink-400">Loading photos…</p>}
          {error && <p className="py-10 text-center text-sm text-status-blocked">{error}</p>}

          {!loading && !error && filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-ink-600">
                {photos.length === 0 ? 'No photos yet. Add the first one.' : 'No photos match these filters.'}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filtered.map((photo) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                onOpen={setOpenPhoto}
                selectMode={compareMode}
                selected={!!selected.find((p) => p.id === photo.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        </div>
      )}

      {compareMode && selected.length === 2 && (
        <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-app border-t border-ink-100 bg-white p-3">
          <button
            onClick={() => setComparing(true)}
            className="w-full rounded-lg bg-signal-500 py-3 text-sm font-medium text-white"
          >
            Compare selected photos
          </button>
        </div>
      )}

      {openPhoto && (
        <PhotoDetail
          photo={openPhoto}
          onClose={() => setOpenPhoto(null)}
          onUpdate={onUpdate}
          onDelete={onDelete}
          suggestions={options}
        />
      )}

      {comparing && selected.length === 2 && (
        <CompareView photoA={selected[0]} photoB={selected[1]} onClose={() => setComparing(false)} />
      )}
    </div>
  )
}
