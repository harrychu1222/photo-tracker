import { statusMeta } from '../../statusConfig'

export default function PhotoCard({ photo, onOpen }) {
  const status = statusMeta(photo.status)

  return (
    <button
      onClick={() => onOpen(photo)}
      className="group relative aspect-square overflow-hidden rounded-xl bg-ink-100 text-left"
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

      <span
        className="status-dot absolute right-2 top-2 border-2 border-white shadow"
        style={{ backgroundColor: status.color }}
        aria-label={status.label}
      />

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4">
        <p className="truncate text-xs font-medium text-white">{photo.location || 'Untitled location'}</p>
        {photo.category && <p className="truncate text-[11px] text-white/80">{photo.category}</p>}
      </div>
    </button>
  )
}
