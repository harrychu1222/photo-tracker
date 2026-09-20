import { useMemo, useState } from 'react'
import { statusMeta } from '../../statusConfig'

const selectClass =
  'w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm text-ink-800 focus:border-signal-500'

function dateKey(iso) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function TimelineView({ photos, options, onOpen }) {
  const [location, setLocation] = useState(options.locations[0] || '')
  const [room, setRoom] = useState('')

  const roomsForLocation = useMemo(() => {
    const uniq = new Set(photos.filter((p) => p.location === location).map((p) => p.room).filter(Boolean))
    return Array.from(uniq).sort()
  }, [photos, location])

  const grouped = useMemo(() => {
    const matches = photos
      .filter((p) => (!location || p.location === location) && (!room || p.room === room))
      .sort((a, b) => new Date(a.taken_at || a.created_at) - new Date(b.taken_at || b.created_at))

    const groups = []
    for (const photo of matches) {
      const key = dateKey(photo.taken_at || photo.created_at)
      const last = groups[groups.length - 1]
      if (last && last.key === key) {
        last.photos.push(photo)
      } else {
        groups.push({ key, photos: [photo] })
      }
    }
    return groups
  }, [photos, location, room])

  if (options.locations.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-sm text-ink-600">
        No photos yet — add some, then come back to see their timeline.
      </div>
    )
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">Project</label>
          <select
            value={location}
            onChange={(e) => {
              setLocation(e.target.value)
              setRoom('')
            }}
            className={selectClass}
          >
            {options.locations.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">Room</label>
          <select value={room} onChange={(e) => setRoom(e.target.value)} className={selectClass}>
            <option value="">All rooms</option>
            {roomsForLocation.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {grouped.length === 0 && (
        <p className="py-10 text-center text-sm text-ink-600">No photos yet for this location/room.</p>
      )}

      <div className="space-y-6">
        {grouped.map((group) => (
          <div key={group.key}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">{group.key}</p>
            <div className="space-y-2">
              {group.photos.map((photo) => {
                const status = statusMeta(photo.status)
                return (
                  <button
                    key={photo.id}
                    onClick={() => onOpen(photo)}
                    className="flex w-full items-center gap-3 rounded-xl border border-ink-100 p-2 text-left"
                  >
                    {photo.url && (
                      <img src={photo.url} alt="" className="h-16 w-16 flex-shrink-0 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink-900">
                        <span className="status-dot" style={{ backgroundColor: status.color }} />
                        {photo.category || 'Untitled'}
                      </p>
                      <p className="truncate text-xs text-ink-500">
                        {new Date(photo.taken_at || photo.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {photo.notes ? ` · ${photo.notes}` : ''}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
