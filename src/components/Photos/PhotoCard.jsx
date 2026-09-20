import { statusMeta, quotingStatusMeta } from '../../statusConfig'

export default function PhotoCard({ photo, onOpen, selectMode = false, selected = false, onToggleSelect }) {
  const status = statusMeta(photo.status)
  const qMeta = quotingStatusMeta(photo.quoting_status)

  function handleClick() {
    if (selectMode) {
      onToggleSelect(photo)
    } else {
      onOpen(photo)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`group relative aspect-square overflow-hidden rounded-xl bg-ink-100 text-left ${
        selectMode && selected ? 'ring-4 ring-signal-500' : ''
      }`}
    >
      {photo.url ? (
        <img
          src={photo.url}
          alt={photo.location || 'Site photo'}
          loading="lazy"
          className="h-full w-full object-cover transition group-active:scale-95"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-ink-400">No preview</div>
      )}

      {selectMode && (
        <span
          className={`absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
            selected ? 'border-signal-500 bg-signal-500 text-white' : 'border-white bg-black/30 text-transparent'
          }`}
        >
          ✓
        </span>
      )}

      <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
        <span className="status-dot border-2 border-white shadow" style={{ backgroundColor: status.color }} aria-label={status.label} />
        {qMeta && (
          <span className="status-dot border-2 border-white shadow" style={{ backgroundColor: qMeta.color }} aria-label={qMeta.label} />
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4">
        <p className="truncate text-xs font-medium text-white">{photo.location || 'Untitled location'}</p>
        {(photo.room || photo.category) && (
          <p className="truncate text-[11px] text-white/80">{[photo.room, photo.category].filter(Boolean).join(' · ')}</p>
        )}
      </div>
    </button>
  )
}
