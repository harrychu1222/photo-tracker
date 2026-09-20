import { useState } from 'react'

export default function CompareView({ photoA, photoB, onClose }) {
  const [split, setSplit] = useState(50)
  const [swapped, setSwapped] = useState(false)

  const before = swapped ? photoB : photoA
  const after = swapped ? photoA : photoB

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button onClick={onClose} className="text-2xl leading-none" aria-label="Close">
          ×
        </button>
        <button
          onClick={() => setSwapped((s) => !s)}
          className="rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium"
        >
          Swap before/after
        </button>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-app flex-1 overflow-hidden">
        {/* "After" image is the full-size base layer */}
        <img src={after.url} alt="After" className="absolute inset-0 h-full w-full object-cover" />

        {/* "Before" image is clipped to the slider position, sitting on top */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${split}%` }}>
          <img
            src={before.url}
            alt="Before"
            className="h-full max-w-none object-cover"
            style={{ width: `${(100 / split) * 100}%` }}
          />
        </div>

        <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${split}%` }} />

        <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-xs font-medium text-white">
          Before
        </span>
        <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs font-medium text-white">
          After
        </span>
      </div>

      <div className="px-6 py-4">
        <input
          type="range"
          min={1}
          max={99}
          value={split}
          onChange={(e) => setSplit(Number(e.target.value))}
          className="w-full"
        />
        <div className="mt-2 flex justify-between text-xs text-white/70">
          <span>{before.location || 'Untitled'} · {new Date(before.created_at).toLocaleDateString()}</span>
          <span>{after.location || 'Untitled'} · {new Date(after.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  )
}
