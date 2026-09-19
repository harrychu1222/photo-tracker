import { useMemo, useState } from 'react'
import FilterBar from './FilterBar'
import PhotoCard from './PhotoCard'
import PhotoDetail from './PhotoDetail'

export default function Gallery({ photos, loading, error, onUpdate, onDelete }) {
  const [filters, setFilters] = useState({ search: '', status: null, tags: [] })
  const [openPhoto, setOpenPhoto] = useState(null)

  const allTags = useMemo(() => {
    const set = new Set()
    photos.forEach((p) => p.tags?.forEach((t) => set.add(t)))
    return Array.from(set).sort()
  }, [photos])

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return photos.filter((p) => {
      if (filters.status && p.status !== filters.status) return false
      if (filters.tags.length && !filters.tags.every((t) => p.tags?.includes(t))) return false
      if (q && !(p.location?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q))) return false
      return true
    })
  }, [photos, filters])

  return (
    <div>
      <FilterBar filters={filters} onChange={setFilters} allTags={allTags} />

      <div className="px-4 py-4">
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
            <PhotoCard key={photo.id} photo={photo} onOpen={setOpenPhoto} />
          ))}
        </div>
      </div>

      {openPhoto && (
        <PhotoDetail
          photo={openPhoto}
          onClose={() => setOpenPhoto(null)}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}
